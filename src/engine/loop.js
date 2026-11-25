// Engine subsystem: loop. See AGENTS.md for ownership and test routes.
import {STEP,ATTACK_TIMING,CHASSIS,DURATION} from './config.js?v=balance-312';
import {chooseTarget} from './targeting.js?v=balance-312';
import {distance,clearLine,bound} from './geometry.js?v=balance-312';
import {measure} from './telemetry.js?v=balance-312';
import {stats,resolveResistance} from './stats.js?v=balance-312';
import {tacticalAssessment,reactToThreat,utilityMove,disengageDirection} from './utilities.js?v=balance-312';
import {startAttack,attackMovementMultiplier,advanceAttack} from './combat.js?v=balance-312';
import {chooseMovement} from './movement.js?v=balance-312';
import {advanceFollowthrough,resolveFollowthroughImpacts} from './followthrough.js?v=balance-312';
import {resolveCollision} from './collision.js?v=balance-312';
import {advanceProjectiles} from './projectiles.js?v=balance-312';
import {resolveAttackModules,environmentalAttacks,applyRicochetSlide} from './effects.js?v=balance-312';

export function tick(state,dt=STEP){if(state.phase!=='fight')return null;state.time+=dt;state.tick++;state.visualEvents=[];
 // Snapshot intentions for all units before sequential movement begins.
 for(const unit of state.units){
  if(unit.hp<=0)continue;
  const opponents=state.units.filter(e=>e.hp>0&&e.owner!==unit.owner);
  const target=opponents.length?chooseTarget(state,unit,opponents):null;
  unit.focus=target?.id??null;
  if(unit.ricochetStunUntil>state.time){unit.intent={x:0,y:0};continue;}
  const prior=unit.moveDecision||{x:0,y:0};
  const norm=Math.hypot(prior.x,prior.y);
  unit.intent=norm>1e-8?{x:prior.x/norm,y:prior.y/norm}:unit.holdingPosition?{x:0,y:0}:target?{x:(target.x-unit.x)/Math.max(1,distance(unit,target)),y:(target.y-unit.y)/Math.max(1,distance(unit,target))}:{x:0,y:0};
 }
for(const u of state.units){if(u.hp<=0)continue;if(u.chassis.passives.includes('inspiration'))for(const ally of state.units){if(ally===u||ally.hp<=0||ally.owner!==u.owner||distance(u,ally)>110)continue;for(const cds of [ally.mobilityCd,ally.reactionCd])for(const key of Object.keys(cds||{}))if(cds[key]>state.time){const before=cds[key];cds[key]=Math.max(state.time,cds[key]-dt*.35);measure(state,u,'inspiration','cooldownSecondsSaved',before-cds[key]);}}}
const attacks=[],wasAlive=new Set(state.units.filter(u=>u.hp>0).map(u=>u.owner));for(const u of state.units){if(u.hp<=0)continue;u.stateTime=state.time;const st=stats(u);if(u.chassis.passives.includes('regen'))u.hp=Math.min(u.maxHp,u.hp+2*dt);u.cd-=dt;if(u.ricochetStunUntil>state.time){u.moveDecision={x:0,y:0};u.intent={x:0,y:0};continue;}const enemies=state.units.filter(e=>e.hp>0&&e.owner!==u.owner);if(!enemies.length)continue;const t=chooseTarget(state,u,enemies);if(!t)continue;u.focus=t.id;const awareness=tacticalAssessment(state,u,t,st,enemies);
 reactToThreat(state,u,t,st,awareness);
 const activeStats=stats(u);
 if(state.moduleTelemetry){if(u.rallyUntil>state.time){const source=state.units.find(a=>a.id===u.rallySource);if(source)measure(state,source,'rally','allyBuffSeconds',dt);}if(u.chassis.mods.resolve&&u.effects?.slowUntil>state.time){measure(state,u,'resolve','slowActiveSeconds',dt);measure(state,u,'resolve','slowFractionSecondsAvoided',Math.min(.45,u.effects.slowStrength||0)*resolveResistance(u)*dt);}for(const key of ['fortify','steadfast','anchor'])if(u[key+'Until']>state.time)measure(state,u,key,'activeSeconds',dt);}
 const retreating=u.disengageUntil>state.time;
 if(!retreating&&u.disengageUntil&&u.disengageUntil<=state.time){
  u.disengageUntil=0;u.focus=null;u.navigation=null;u.navProgress=null;
 }
 const d=distance(u,t),visible=clearLine(u,t,state.arena),inRange=d<=activeStats.range&&visible;
 if(!u.attack){
  // Facing follows a target smoothly while moving; windup later locks the direction.
  const desired=Math.atan2(t.y-u.y,t.x-u.x);
  const delta=Math.atan2(Math.sin(desired-u.facing),Math.cos(desired-u.facing));
  u.facing+=Math.max(-dt*10,Math.min(dt*10,delta));
 }
 if(!u.attack&&!retreating&&!(u.followthroughCommit?.until>state.time)&&inRange&&u.cd<=0)startAttack(state,u,t);
 // Committed attacks reduce movement; only an emergency Dodge can cancel windup.
 const committing=u.followthroughCommit?.until>state.time-dt;
 if(!u.attack&&!retreating&&!committing)utilityMove(state,u,t,activeStats,dt,enemies,awareness);
 const direction=committing?{x:u.followthroughCommit.x,y:u.followthroughCommit.y}:
  retreating?disengageDirection(state,u,enemies):chooseMovement(state,u,t,activeStats,enemies,dt);
 if(committing||retreating)u.holdingPosition=false;
 u.moveDecision=direction;u.moveTarget=t.id;
 if(state.diagnostics){const d=state.diagnostics;const record=d.units[u.id]||(d.units[u.id]={owner:u.owner,type:u.type,frames:0,idle:0,blocked:0,replans:0,stuck:0,waypointChanges:0,collisionLoss:0,intended:0,actual:0,attackOpportunities:0,shots:0,damage:0,routeProgress:0,reversals:0,reasonCounts:{},samples:[]});
 record.frames++;if(!direction.x&&!direction.y)record.idle++;
 if(u.supportingAlly!=null){
  record.supportFrames=(record.supportFrames||0)+1;
  if(u.supportMode==='screen')record.screenFrames=(record.screenFrames||0)+1;
  if(u.holdingPosition)record.supportHoldFrames=(record.supportHoldFrames||0)+1;
 }
 if(u.holdingPosition){
  record.deliberateHolds=(record.deliberateHolds||0)+1;
  if(inRange)record.holdWithAttackAccess=(record.holdWithAttackAccess||0)+1;
  else record.holdAwaitingApproach=(record.holdAwaitingApproach||0)+1;
 }
 if(u.navigationBlocked)record.blocked++;
 const route=u.navigation,waypoint=route?.path?.[0];const key=waypoint?Math.round(waypoint.x)+','+Math.round(waypoint.y):'none';
 if(record.lastWaypoint!==undefined&&record.lastWaypoint!==key)record.waypointChanges++;record.lastWaypoint=key;
 if(record.lastRoute&&route!==record.lastRoute){record.replans++;const reason=record.lastTarget!==t.id?'target-changed':u.navRecoverUntil>state.time?'stuck-recovery':'route-invalid-or-destination';record.reasonCounts[reason]=(record.reasonCounts[reason]||0)+1}record.lastRoute=route;record.lastTarget=t.id;
 if((u.navStuckCount||0)>record.stuck){record.stuck=u.navStuckCount;record.reasonCounts.stuck=(record.reasonCounts.stuck||0)+1}
 if(record.lastDirection&&direction.x*record.lastDirection.x+direction.y*record.lastDirection.y<-.5)record.reversals++;record.lastDirection={x:direction.x,y:direction.y};
 if(inRange)record.attackOpportunities++;
 record.before={x:u.x,y:u.y,step:activeStats.speed*dt*(committing?(u.followthroughCommit.speedFactor):attackMovementMultiplier(u)),seeking:!inRange,waypointDistance:waypoint?distance(u,waypoint):null};
 }
 if(direction.x||direction.y){
  if(committing){advanceFollowthrough(state,u,dt)}
  else{const step=activeStats.speed*dt*(retreating?1+Math.min(.35,Math.max(0,u.chassis.mods.disengage-1)*.1):attackMovementMultiplier(u));u.x+=direction.x*step;u.y+=direction.y*step;bound(u,state.arena)}
  u.move=direction;
 }
 if(u.attack){if(state.diagnostics&&u.attack.phase==='windup'&&u.attack.elapsed+dt>=ATTACK_TIMING[u.type].windup)state.diagnostics.units[u.id].shots++;advanceAttack(state,u,t,activeStats,dt,attacks)}}
 resolveCollision(state);
 for(const u of state.units){
  if(u.followthroughStepStart){
   const commit=u.followthroughCommit;
   const before=u.followthroughStepStart;
   const progress=(u.x-before.x)*commit.x+(u.y-before.y)*commit.y;
   if(u.combatStats)u.combatStats.followthroughDistance=(u.combatStats.followthroughDistance||0)+Math.max(0,progress);
   delete u.followthroughStepStart;
  }

  const path=u.motion||(u.motion=[]);
  if(u.hp>0&&u.chassis.passives.includes('wake')&&state.time>=(u.wakeAt||0)&&path.length&&distance(u,path.at(-1))>.5){u.wakeAt=state.time+.5;measure(state,u,'wake','patchesCreated');state.zones.push({x:u.x,y:u.y,owner:u.owner,source:u,radius:20,dps:0,slow:true,until:state.time+1.2});}
  path.push({time:state.time,x:u.x,y:u.y});
  while(path.length>2&&path[1].time<state.time-2)path.shift();
 }
 if(state.diagnostics){for(const u of state.units){const record=state.diagnostics.units[u.id];if(!record?.before)continue;const before=record.before,actual=distance(before,u);record.actual+=actual;record.intended+=before.step*(record.lastDirection.x||record.lastDirection.y?1:0);if(before.step>0&&actual<before.step*.2&&(record.lastDirection.x||record.lastDirection.y))record.collisionLoss++;if(before.seeking&&before.step>0&&(record.lastDirection.x||record.lastDirection.y)&&actual<before.step*.2)record.pursuitStallFrames=(record.pursuitStallFrames||0)+1;else record.pursuitStallFrames=0;record.maxPursuitStallFrames=Math.max(record.maxPursuitStallFrames||0,record.pursuitStallFrames);if(before.waypointDistance!==null&&u.navigation?.path?.[0])record.routeProgress+=before.waypointDistance-distance(u,u.navigation.path[0]);delete record.before;
 if(state.tick%30===0&&record.samples.length<35)record.samples.push({t:Math.round(state.time),x:Math.round(u.x),y:Math.round(u.y),idle:record.idle,blocked:record.blocked,stuck:record.stuck});}}
 // This telemetry is opt-in and does not change AI decisions or reward kills.
 // Mutual passivity requires ALL active fighters to be holding outside an attack
 // opportunity, with no attack committed and no projectile in flight.
 if(state.diagnostics){
  const d=state.diagnostics,units=state.units.filter(u=>u.hp>0);
  const active=units.filter(u=>state.units.some(e=>e.hp>0&&e.owner!==u.owner));
  const holding=active.filter(u=>u.holdingPosition);
  const opportunity=active.some(u=>state.units.some(e=>e.hp>0&&e.owner!==u.owner&&
   clearLine(u,e,state.arena)&&distance(u,e)<=stats(u).range));
  const committed=active.some(u=>u.attack)||(state.projectiles||[]).length>0||attacks.length>0;
  const passive=active.length>=2&&holding.length===active.length&&!opportunity&&!committed;
  d.tactical||={frames:0,holdingUnitFrames:0,mutualPassiveFrames:0,
   maxMutualPassiveFrames:0,mutualPassiveStreak:0,productiveCombatFrames:0,
   attackReleases:0,holdWithAttackAccess:0,holdAwaitingApproach:0};
  const t=d.tactical;t.frames++;t.holdingUnitFrames+=holding.length;
  const holdingWithAccess=holding.filter(u=>state.units.some(e=>e.hp>0&&e.owner!==u.owner&&
   clearLine(u,e,state.arena)&&distance(u,e)<=stats(u).range)).length;
  t.holdWithAttackAccess+=holdingWithAccess;
  t.holdAwaitingApproach+=holding.length-holdingWithAccess;
  // Attack releases are fighter events, NOT the number of hit records.
  // This includes projectile launches and counts multi-target releases once.
  t.attackReleases=state.units.reduce((sum,u)=>sum+(u.combatStats?.attacks||0),0);
  t.supportUnitFrames=(t.supportUnitFrames||0)+active.filter(u=>u.supportingAlly!=null).length;
  t.screenUnitFrames=(t.screenUnitFrames||0)+active.filter(u=>u.supportMode==='screen').length;
  if(opportunity||committed)t.productiveCombatFrames++;
  if(passive){t.mutualPassiveFrames++;t.mutualPassiveStreak++}
  else t.mutualPassiveStreak=0;
  t.maxMutualPassiveFrames=Math.max(t.maxMutualPassiveFrames,t.mutualPassiveStreak);
 }
 advanceProjectiles(state,dt,attacks);
 // Evasion blocks impacts and their on-hit effects before any status is applied.
 const landed=attacks.filter(a=>{
  if(a.target.evadingUntil<=state.time)return true;
  a.target.combatStats&&(a.target.combatStats.evaded++);
  return false;
 });
 const resolved=resolveAttackModules(state,landed).concat(environmentalAttacks(state,dt));
 // Preserve a visual distinction between direct hits and fractional DoT ticks.
 const directTargets=new Set(resolved.filter(a=>!a.indirect).map(a=>a.target));
 const totals=new Map();
 for(const a of resolved){
  // Estimate the defense prevented by a timed Bulwark rather than counting
  // hypothetical dodged damage as prevention.
  if(a.target.bulwarkUntil>state.time&&a.target.combatStats){
   const base=CHASSIS[a.target.type].defense+(a.target.chassis.passives.includes('bulwark')?0:0);
   const legacy=a.target.chassis.mods||{};
   const raw=a.rawDamage??a.damage;
   const prevented=Math.max(0,Math.max(1,raw-base)-a.damage);
   a.target.combatStats.prevented+=prevented;
  }
  if(a.projectile&&a.source.combatStats)a.source.combatStats.hits++;
  if(a.target.shieldUntil>state.time&&a.target.shield>0){const absorbed=Math.min(a.target.shield,a.damage);a.target.shield-=absorbed;a.damage-=absorbed;if(state.moduleTelemetry){const source=state.units.find(u=>u.id===a.target.shieldSource);if(source)measure(state,source,'aegis','damageAbsorbed',absorbed);}}
  const prior=totals.get(a.target)||0;
  const dealt=Math.max(0,Math.min(a.damage,a.target.hp-prior));
  if(dealt>0){
   if(a.postBounce)measure(state,a.source,'ricochet','postBounceActualDamage',dealt);
    if(a.moduleDamage?.resonance)measure(state,a.source,'resonance','creditedDamage',Math.min(dealt,a.moduleDamage.resonance*dealt/Math.max(1e-9,a.damage)));
   const combat=a.source.combatStats;
   if(combat){
    combat.moduleDamage||={};
    combat.moduleHits||={};
    for(const [key,potential] of Object.entries(a.moduleDamage||{})){
     const credit=Math.min(dealt,potential*dealt/Math.max(1e-9,a.damage));
     if(credit>0)combat.moduleDamage[key]=(combat.moduleDamage[key]||0)+credit;
    }
    // Delivery-enabled impacts are tracked independently from damage bonuses:
    // a hit can be both a spread-lane hit and a pierced hit.
    for(const key of a.deliveredBy||[]){
     combat.moduleHits[key]=(combat.moduleHits[key]||0)+dealt;
    }
    if(a.chainRedirected)combat.chainRedirected=(combat.chainRedirected||0)+
     a.chainRedirected*dealt/Math.max(1e-9,a.damage);
   }
   if(!a.indirect&&!a.secondary&&a.source.hp>0&&a.source.chassis.mods.siphon){a.source.pendingSiphon=(a.source.pendingSiphon||0)+dealt*Math.min(.24,.06*a.source.chassis.mods.siphon);}
   state.damageDealt[a.source.owner]+=dealt;
   a.source.combatStats&&(a.source.combatStats.damage+=dealt);
   if(state.diagnostics&&state.diagnostics.units[a.source.id])state.diagnostics.units[a.source.id].damage+=dealt;
  }
  totals.set(a.target,prior+a.damage);
 }
 // Retaliation answers a landed direct melee hit, not projectiles, chain or hazards.
 for(const hit of resolved){
  if(!hit.projectile&&!hit.secondary&&!hit.indirect&&hit.damage>0&&
     hit.target.hp>0&&hit.target.chassis.passives.includes('retaliation')){
   hit.target.retaliationReady=state.time+4;
  }
 }
 // Impact displacement occurs only after evasion filtering and direct-hit resolution.
 // One melee release can hit many enemies but can trigger Follow Through once.
 resolveFollowthroughImpacts(state,resolved);
 for(const [target,damage] of totals){
  const applied=Math.min(target.hp,damage);target.hp=Math.max(0,target.hp-damage);
  target.combatStats&&(target.combatStats.damageTaken+=applied);
  if(applied>0)state.visualEvents.push({kind:directTargets.has(target)?'damage':'dotDamage',
   targetId:target.id,x:target.x,y:target.y,value:applied,owner:target.owner});
 }
 for(const u of state.units){if(u.pendingSiphon){if(u.hp>0){const before=u.hp;u.hp=Math.min(u.maxHp,u.hp+u.pendingSiphon);measure(state,u,'siphon','actualHealing',u.hp-before);measure(state,u,'siphon','overhealing',u.pendingSiphon-(u.hp-before));}u.pendingSiphon=0;}}
 // Taunt begins on a landed attack. Repeated hits refresh the duration; stacks increase it.
 // Multiple simultaneous taunts resolve deterministically in attack processing order.
 for(const a of resolved){if(a.taunt>0&&a.source.hp>0&&a.target.hp>0){a.target.tauntedBy=a.source.id;a.target.tauntedUntil=state.time+.25*a.taunt}}
 const slideContacts=new Set();
 for(const a of resolved){const key=a.attackId==null?a:a.source.id+':'+a.attackId+':'+a.target.id;if(slideContacts.has(key))continue;if(applyRicochetSlide(state,a)){slideContacts.add(key);continue;}if(a.knockback&&a.target.hp>0){if(a.target.steadfastUntil>state.time)measure(state,a.target,'steadfast','nominalKnockbackAvoided',a.knockback*4*(1-1/(1+(a.target.steadfastStrength||0))));const d=Math.max(1,distance(a.source,a.target));a.target.x+=(a.target.x-a.source.x)/d*a.knockback*4/(a.target.steadfastUntil>state.time?1+(a.target.steadfastStrength||0):1);a.target.y+=(a.target.y-a.source.y)/d*a.knockback*4/(a.target.steadfastUntil>state.time?1+(a.target.steadfastStrength||0):1);bound(a.target,state.arena)}}
 for(const u of state.units)if(u.hp===0&&!u.reported){u.reported=true;state.events.push(state.players[u.owner].name+' '+CHASSIS[u.type].name+' defeated');}
 const nowAlive=new Set(state.units.filter(u=>u.hp>0).map(u=>u.owner));for(const owner of wasAlive)if(!nowAlive.has(owner)){state.eliminations.push({owner,tick:state.tick});state.events.push(state.players[owner].name+' team eliminated')}
 if(nowAlive.size<=1||state.time>=DURATION)return [...nowAlive];return null}
