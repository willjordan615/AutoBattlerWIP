// Engine subsystem: utilities. See AGENTS.md for ownership and test routes.
import {CHASSIS,PROJECTILE_RADIUS,ATTACK_TIMING,UTILITY_MOVE_SCALE,STEP,radiusOf} from './config.js?v=engine-323-r1';
import {segmentCircleHit,clearLine,distance,rectHit,bound} from './geometry.js?v=engine-323-r1';
import {stats} from './stats.js?v=engine-323-r1';
import {measure} from './telemetry.js?v=engine-323-r1';
import {healthFraction} from './targeting.js?v=engine-323-r1';
import {holdingOpportunity,positionScore} from './positioning.js?v=engine-323-r1';

// One small deterministic threat/opportunity assessment per fighter per tick.
// Projectile risk uses projected swept motion; melee risk uses attack readiness.
export function tacticalAssessment(state,u,target,st,enemies){
 const now=state.time,lookahead=.26,radius=radiusOf(u)+PROJECTILE_RADIUS+2;
 const shots=[];
 for(const shot of state.projectiles||[]){
  if(shot.owner===u.owner)continue;
  const horizon=Math.min(lookahead,shot.remaining/Math.max(1,shot.speed));
  if(horizon<=0)continue;
  const end={x:shot.x+shot.vx*shot.speed*horizon,y:shot.y+shot.vy*shot.speed*horizon};
  const impact=segmentCircleHit(shot,end,u,radius+Math.max(0,(shot.radius||3)-PROJECTILE_RADIUS));
  if(impact===null)continue;
  const when=horizon*impact;
  // A blocking wall means the shot will not reach this fighter.
  const hitPoint={x:shot.x+(end.x-shot.x)*impact,y:shot.y+(end.y-shot.y)*impact};
  if(!clearLine(shot,hitPoint,state.arena,shot.radius||PROJECTILE_RADIUS))continue;
  shots.push({shot,when,damage:Math.max(1,shot.damage-st.defense)});
 }
 shots.sort((a,b)=>a.when-b.when||a.shot.id-b.shot.id);
 const melee=enemies.filter(e=>e.type!=='ranged'&&
  distance(e,u)<stats(e).range+radiusOf(u)+8&&clearLine(e,u,state.arena)&&
  e.attack?.phase==='windup'&&e.attack.locked&&
  Math.abs(Math.atan2(Math.sin(Math.atan2(u.y-e.y,u.x-e.x)-e.attack.direction),
    Math.cos(Math.atan2(u.y-e.y,u.x-e.x)-e.attack.direction)))<
  ATTACK_TIMING[e.type].arc*Math.PI/360+.2);
 const incoming=shots.reduce((sum,x)=>sum+x.damage,0)+melee.reduce((sum,e)=>sum+Math.max(1,stats(e).damage-st.defense),0);
 const close=enemies.filter(e=>distance(e,u)<Math.max(75,stats(e).range+30));
 const d=distance(u,target),clear=clearLine(u,target,state.arena);
 const engaging=d>st.range+20&&clear,retreating=close.length>0&&
  (u.chassis.weights.safety||0)>(u.chassis.weights.distance||0)+.2;
 // A finishing burst needs attacks available soon enough to exploit its window.
 // Requiring more than one ordinary hit prevents using Focus on trivial cleanup.
 const estimatedHit=Math.max(1,st.damage-stats(target).defense);
 const attacksDuringBurst=Math.max(1,Math.floor((1.5-Math.max(0,u.cd))/
  Math.max(.2,st.rate/1.35))+1);
 const finish=clear&&d<=st.range&&u.cd<=st.rate*.85&&
  target.hp>estimatedHit&&target.hp<=estimatedHit*attacksDuringBurst;
 const endangeredAllies=state.units.filter(a=>a!==u&&a.owner===u.owner&&a.hp>0&&
  enemies.some(e=>e.focus===a.id&&distance(e,a)<=stats(e).range+35));
 return {shots,melee,incoming,close,engaging,retreating,finish,endangeredAllies,now};
}
export function reactToThreat(state,u,target,st,context){
 const cds=u.reactionCd||(u.reactionCd={}),now=state.time;
 const ready=k=>(cds[k]||0)<=now;
 const activate=(key,duration,cooldown)=>{
  cds[key]=now+cooldown;u[key+'Until']=now+duration;measure(state,u,key,'activations');
  if(u.combatStats)u.combatStats[key]=(u.combatStats[key]||0)+1;
  state.visualEvents.push({kind:'reaction',ability:key,x:u.x,y:u.y,owner:u.owner});
 };
 // Emergency defense has priority. Dodge is displacement away from the actual
 // incoming projectile direction, not a generic target-relative sidestep.
 if(u.chassis.passives.includes('dodge')&&ready('dodge')&&(context.shots.length||context.melee.length)){
  const imminent=context.shots.filter(x=>x.when<=.20);
  const threat=imminent[0]?.shot||(!context.shots.length?context.melee[0]:null);
  if(threat){
   const heading=imminent.length?{x:threat.vx,y:threat.vy}:
    {x:(u.x-threat.x)/Math.max(1,distance(u,threat)),y:(u.y-threat.y)/Math.max(1,distance(u,threat))};
   const travel=st.speed*.4*.85*UTILITY_MOVE_SCALE,r=radiusOf(u)+3;
   const candidates=[1,-1].map(sign=>{
    const p={x:u.x-heading.y*sign*travel,y:u.y+heading.x*sign*travel};
    const valid=p.x>=20+r&&p.x<=700-r&&p.y>=20+r&&p.y<=500-r&&
     clearLine(u,p,state.arena,r)&&!state.arena.obstacles.some(o=>rectHit(p.x,p.y,r,o));
    if(!valid)return {valid:false,score:-Infinity};
    const projectileRisk=context.shots.filter(({shot})=>{
     const horizon=Math.min(.26,shot.remaining/Math.max(1,shot.speed));
     const end={x:shot.x+shot.vx*shot.speed*horizon,y:shot.y+shot.vy*shot.speed*horizon};
     return segmentCircleHit(shot,end,p,radiusOf(u)+(shot.radius||3))!==null;
    }).length;
    const meleeRisk=context.melee.filter(e=>distance(e,p)<stats(e).range+radiusOf(u)+2).length;
    // Prefer a genuine escape from the path; don't roll sideways into another attacker.
    return {p,valid:true,score:-projectileRisk*10-meleeRisk*3+
     (context.melee.length?Math.min(...context.melee.map(e=>distance(e,p)))*.008:0)};
   }).sort((a,b)=>b.score-a.score);
   const safest=candidates[0];
   // Even a partial lateral roll is worthwhile when its brief invulnerability
   // covers a shot arriving before the fighter can clear the whole collision radius.
   const pathImproved=imminent.length?safest?.score>=-imminent.length*10:
    safest?.score> -context.melee.length*3+.1;
   if(safest?.valid&&pathImproved){
    // Evasion sacrifices an uncommitted attack windup, never grants an instant retry.
    if(u.attack?.phase==='windup'){u.attack=null;u.cd=Math.max(u.cd,.18)}
    const old={x:u.x,y:u.y};u.x=safest.p.x;u.y=safest.p.y;bound(u,state.arena);
    // Covers the roll frame but cannot substitute for an unsafe landing point.
    u.evadingUntil=now+.13;
    cds.dodge=now+utilityCooldown(5,st.dodge);
    u.combatStats&&(u.combatStats.dodges++);
    state.visualEvents.push({kind:'mobility',ability:'dodge',owner:u.owner,type:u.type,x:old.x,y:old.y,toX:u.x,toY:u.y});
   }
  }
 }
 if(u.chassis.passives.includes('bulwark')&&ready('bulwark')&&
  (context.incoming>=Math.max(8,u.hp*.055)||context.close.length>=2)){
  activate('bulwark',2,6);
 }
 if(u.chassis.passives.includes('haste')&&ready('haste')&&(context.engaging||context.retreating)){
  activate('haste',1.5,5);
 }
 if(u.chassis.passives.includes('aegis')&&ready('aegis')){const ally=context.endangeredAllies.filter(a=>distance(a,u)<=120).sort((a,b)=>healthFraction(a)-healthFraction(b)||a.id-b.id)[0];if(ally){ally.shield=Math.max(ally.shieldUntil>now?ally.shield||0:0,12);ally.shieldUntil=now+2;if(state.moduleTelemetry)ally.shieldSource=u.id;measure(state,u,'aegis','shieldApplications');activate('aegis',0,6);}}
 if(u.chassis.passives.includes('anchor')&&ready('anchor')&&context.incoming>0&&holdingOpportunity(state,u,target,st,state.units.filter(e=>e.hp>0&&e.owner!==u.owner))>0)activate('anchor',1.5,6);
 if(u.chassis.passives.includes('repulsion')&&ready('repulsion')&&context.incoming>0){const close=context.close.filter(e=>distance(e,u)<55);if(close.length){for(const e of close){const d=Math.max(1,distance(e,u));const ox=e.x,oy=e.y;e.x+=(e.x-u.x)/d*14;e.y+=(e.y-u.y)/d*14;bound(e,state.arena);measure(state,u,'repulsion','actualDisplacement',Math.hypot(e.x-ox,e.y-oy));}activate('repulsion',0,6);}}
 if(u.chassis.passives.includes('focus')&&ready('focus')&&context.finish){
  activate('focus',1.5,6);
 }
}
// Utility upgrades add a second use window, not a stronger teleport.
export function utilityCooldown(base,copies){return base/Math.min(2,Math.max(1,copies||1))}
export function utilityMove(state,u,target,st,dt,enemies,context){
 const cds=u.mobilityCd||(u.mobilityCd={}),now=state.time,burst=st.speed*.4*UTILITY_MOVE_SCALE;
 // A second copy provides twice the use frequency without longer teleports.
 const ready=key=>(cds[key]||0)<=now;
 const strength=key=>Math.min(1,st[key]||0);
 const base=positionScore(state,u,target,u,st,enemies);
 const d=distance(u,target),dx=(target.x-u.x)/Math.max(1,d),dy=(target.y-u.y)/Math.max(1,d);
 const proposals=[];
 const offer=(key,point,dist,cooldown,options={})=>{
  if(!st[key]||!ready(key))return;
  const length=distance(u,point);
  if(length<1)return;
  const step=Math.min(dist,length);
  const p={x:u.x+(point.x-u.x)/length*step,y:u.y+(point.y-u.y)/length*step};
  if(!clearLine(u,p,state.arena,radiusOf(u)+3))return;
  const score=positionScore(state,u,target,p,st,enemies);
  proposals.push({key,p,score,cooldown,options});
 };
 const nearest=enemies.reduce((n,e)=>Math.min(n,distance(u,e)),Infinity);
 const threatened=nearest<Math.max(65,st.range*.65);
 const allies=state.units.filter(a=>a.hp>0&&a.owner===u.owner&&a!==u);
 // Intercept the aggressor, not the ally being defended.
 // Prefer an enemy explicitly focused on an ally; nearby threats are a fallback.
 const attackers=enemies.flatMap(e=>allies.map(a=>({
  enemy:e,ally:a,explicit:e.focus===a.id,proximity:distance(e,a)
 })).filter(pair=>pair.explicit||pair.proximity<65))
 .sort((a,b)=>Number(b.explicit)-Number(a.explicit)||a.proximity-b.proximity||distance(u,a.enemy)-distance(u,b.enemy)||a.enemy.id-b.enemy.id);
 const intercept=attackers.find(pair=>distance(u,pair.enemy)>st.range*.6&&distance(u,pair.enemy)<260);
 if(intercept&&context.endangeredAllies.length)offer('intercept',intercept.enemy,burst*(.8+.2*strength('intercept')),5,{urgent:true});
 // Dodge is an emergency reaction, handled before routine utility movement.
 if((context.close.length>0||context.melee.length>0)&&d<Math.max(85,st.range*.8))offer('backstep',{x:u.x-dx*110,y:u.y-dy*110},burst*(.75+.2*strength('backstep')),4.5);
 if(context.engaging&&d<st.range+190)offer('dash',{x:target.x-dx*Math.max(10,st.range*.7),y:target.y-dy*Math.max(10,st.range*.7)},burst*(1+.35*strength('dash')),5);
 if(d>st.range*.7&&d<st.range+100&&clearLine(u,target,state.arena))for(const side of [-1,1])offer('flank',{x:target.x-dx*st.range-side*dy*(35+strength('flank')*12),y:target.y-dy*st.range+side*dx*(35+strength('flank')*12)},burst*(.65+.2*strength('flank')),4);
 // Abilities are optional tools. Their projected position must beat staying
 // and ordinary walking; high Safety/Protection/etc. determines their use.
 const normal=u.moveDecision||{x:0,y:0};
 const walk={x:u.x+normal.x*st.speed*dt,y:u.y+normal.y*st.speed*dt};
 const threshold=Math.max(base,positionScore(state,u,target,walk,st,enemies))+.015;
 const best=proposals.sort((a,b)=>b.score-a.score)[0];
 if(!best||(!best.options.urgent&&best.score<=threshold))return false;
 const ox=u.x,oy=u.y;u.x=best.p.x;u.y=best.p.y;bound(u,state.arena);
 cds[best.key]=now+utilityCooldown(best.cooldown,st[best.key]);
 if(best.options.evade)u.evadingUntil=now+best.options.evade;
 state.visualEvents.push({kind:'mobility',x:ox,y:oy,toX:u.x,toY:u.y,owner:u.owner,type:u.type,ability:best.key});
 return true;
}
// The after-attack Disengage module temporarily replaces ordinary movement
// preferences with maximum separation from nearby enemies. It remains subject
// to arena walls/obstacles and cannot initiate another attack until the window ends.
export function disengageDirection(state,u,enemies){
 if(!enemies.length)return {x:0,y:0};
 const candidates=[];
 const nearby=enemies.slice().sort((a,b)=>distance(u,a)-distance(u,b));
 const most=nearby[0],away=Math.atan2(u.y-most.y,u.x-most.x);
 for(const offset of [0,.35,-.35,.7,-.7,1.1,-1.1,1.5,-1.5,Math.PI]){
  const dir={x:Math.cos(away+offset),y:Math.sin(away+offset)};
  const step=stats(u).speed*STEP*(1+Math.min(.35,Math.max(0,u.chassis.mods.disengage-1)*.1));
  const end={x:u.x+dir.x*step,y:u.y+dir.y*step};
  const r=radiusOf(u)+3;
  if(end.x<20+r||end.x>700-r||end.y<20+r||end.y>500-r)continue;
  if(!clearLine(u,end,state.arena,r))continue;
  if(state.arena.obstacles.some(o=>rectHit(end.x,end.y,r,o)))continue;
  const pressure=nearby.reduce((value,e)=>{
   const d=distance(u,e),next=distance(end,e);
   return value+(next-d)/(Math.max(35,d)*Math.max(1,Math.sqrt(d/65)));
  },0);
  const collision=state.units.filter(v=>v!==u&&v.hp>0).reduce((p,v)=>{
   const distanceTo=distance(end,v),buffer=radiusOf(u)+radiusOf(v)+8;
   return p+Math.max(0,buffer-distanceTo)*.04;
  },0);
  candidates.push({dir,score:pressure-collision+Math.cos(offset)*.001});
 }
 return candidates.sort((a,b)=>b.score-a.score)[0]?.dir||{x:0,y:0};
}
