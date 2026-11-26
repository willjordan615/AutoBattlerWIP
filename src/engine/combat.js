// Engine subsystem: combat. See AGENTS.md for ownership and test routes.
import {ATTACK_TIMING,CHASSIS,radiusOf,attackTimeScale,morphologyTier} from './config.js?v=engine-330-r1';
import {clearLine,distance,inRearSector} from './geometry.js?v=engine-330-r1';
import {measure} from './telemetry.js?v=engine-330-r1';
import {spawnProjectileVolley} from './projectiles.js?v=engine-330-r1';
import {stats} from './stats.js?v=engine-330-r1';

// Each firing cycle fans out into independent lanes. A lane can pierce deeper,
// but an enemy can only be hit once across all lanes in that cycle.
// Melee shape is locked during windup, then evaluated at the actual release.
export function meleeAttackTargets(state,u,angle,st){
 const profile=ATTACK_TIMING[u.type],wide=(profile.arc+st.area*12)*Math.PI/180;
 const laneCount=Math.min(9,Math.max(1,st.projectiles));
 const laneSpacing=(profile.arc*.7)*Math.PI/180;
 const lanes=Array.from({length:laneCount},(_,i)=>angle+(i===0?0:(i%2?1:-1)*Math.ceil(i/2)*laneSpacing));
 const candidates=[];
 for(const enemy of state.units){
  if(enemy.owner===u.owner||enemy.hp<=0||!clearLine(u,enemy,state.arena))continue;
  const d=distance(u,enemy),reach=st.range+st.area*9+radiusOf(enemy);
  if(d>reach||d<1e-7)continue;
  const bearing=Math.atan2(enemy.y-u.y,enemy.x-u.x);
  const within=lanes.some(lane=>Math.abs(Math.atan2(Math.sin(bearing-lane),Math.cos(bearing-lane)))<=
   wide/2+Math.asin(Math.min(.98,radiusOf(enemy)/Math.max(1,d))));
  if(within)candidates.push({enemy,d});
 }
 candidates.sort((a,b)=>a.d-b.d||a.enemy.id-b.enemy.id);
 return candidates.slice(0,1+Math.max(0,st.piercing)).map(c=>c.enemy);
}

export function attackWindup(u){const base=ATTACK_TIMING[u.type].windup*attackTimeScale(u);return u.type==='ranged'?base:base/ (1+.176470588*(u.chassis.mods.velocity||0));}
export function startAttack(state,u,target){
 if(u.attack||u.cd>0||!target||target.hp<=0)return false;
 const angle=Math.atan2(target.y-u.y,target.x-u.x);
 const profile=ATTACK_TIMING[u.type];
 u.facing=angle;
 u.attack={phase:'windup',elapsed:0,direction:angle,locked:false,targetId:target.id};
 return true;
}
export function advanceAttack(state,u,target,st,dt,attacks){
 const attack=u.attack;
 if(!attack)return;
 const profile=ATTACK_TIMING[u.type],timing=attackTimeScale(u);
 attack.elapsed+=dt;
 if(attack.phase==='windup'){
  if(!attack.locked){
   if(target?.hp>0)attack.direction=Math.atan2(target.y-u.y,target.x-u.x);
   u.facing=attack.direction;
   if(attack.elapsed>=attackWindup(u)*profile.lock){
    attack.locked=true;
    state.visualEvents.push({kind:'attackCommit',x:u.x,y:u.y,owner:u.owner,
     type:u.type,angle:attack.direction,reach:st.range,arc:profile.arc});
   }
  }
  if(attack.elapsed+1e-8<attackWindup(u))return;
  attack.phase='recovery';attack.elapsed=0;
  if(u.chassis.mods.velocity){measure(state,u,'velocity','releases');measure(state,u,'velocity','nominalWindupSecondsSaved',profile.windup*timing-attackWindup(u));}
  u.combatStats&&(u.combatStats.attacks++);
  // Only enemies inside the locked attack shape at release can be hit.
  const attackId=state.nextAttackId++;
  if(st.delivery==='projectile'){
   const dx=Math.cos(attack.direction),dy=Math.sin(attack.direction);
   spawnProjectileVolley(state,u,{id:attack.targetId,x:u.x+dx*st.range,y:u.y+dy*st.range},st,attack.direction,attackId,!!attack.followthroughBonus);
  }else{
   const victims=meleeAttackTargets(state,u,attack.direction,st);
   for(let i=0;i<victims.length;i++){
    const victim=victims[i];
    const bearing=Math.atan2(victim.y-u.y,victim.x-u.x);
    const diff=Math.abs(Math.atan2(Math.sin(bearing-attack.direction),Math.cos(bearing-attack.direction)));
    const radius=radiusOf(victim),dist=Math.max(1,distance(u,victim));
    const baseArc=ATTACK_TIMING[u.type].arc*Math.PI/360+
     Math.asin(Math.min(.98,radius/dist));
    const deliveredBy=[];
    if(i>0&&st.piercing>0)deliveredBy.push('piercing');
    // A spread lane can reach outside the original, unmodified attack cone.
    if(st.projectiles>1&&diff>baseArc&&st.area===0)deliveredBy.push('projectiles');
    if(st.area>0&&(diff>baseArc||dist>st.range+radius))deliveredBy.push('area');
    const naturalRange=CHASSIS[u.type].range*(1+.12*morphologyTier(u));
    if(st.range>naturalRange&&dist>naturalRange+st.area*9+radius)deliveredBy.push('range');
    attacks.push({source:u,target:victim,attackId,followthroughBonus:!!attack.followthroughBonus,attackOrigin:{x:u.x,y:u.y},attackDirection:attack.direction,rawDamage:st.damage,
     rearHit:inRearSector(victim,u.x-victim.x,u.y-victim.y),
     damage:Math.max(1,st.damage-stats(victim).defense),
     knockback:st.knockback,taunt:st.taunt,deliveredBy});
   }
  }
  if(u.chassis.mods.rally)for(const ally of state.units){if(ally!==u&&ally.hp>0&&ally.owner===u.owner&&distance(u,ally)<=110){ally.rallyUntil=state.time+1.2;ally.rallyStrength=Math.min(.3,.08*u.chassis.mods.rally);if(state.moduleTelemetry)ally.rallySource=u.id;measure(state,u,'rally','allyApplications');}}
  u.cd+=st.rate+profile.windup*timing-attackWindup(u);
  if(u.chassis.mods.disengage){
   u.disengageUntil=state.time+.5;
   u.navigation=null;u.navProgress=null;
   state.visualEvents.push({kind:'reaction',ability:'disengage',x:u.x,y:u.y,owner:u.owner});
  }
  return;
 }
 if(attack.phase==='recovery'&&attack.elapsed+1e-8>=profile.recovery*timing+profile.windup*timing-attackWindup(u))u.attack=null;
}
export function attackMovementMultiplier(u){
 if(!u.attack)return 1;
 const profile=ATTACK_TIMING[u.type];
 return u.attack.phase==='windup'?profile.windupMove:profile.recoveryMove;
}
