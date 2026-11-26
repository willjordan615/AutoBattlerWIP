// Engine subsystem: projectiles. See AGENTS.md for ownership and test routes.
import {measure} from './telemetry.js?v=engine-323-final';
import {PROJECTILE_SPEED,PROJECTILE_RADIUS,CHASSIS,radiusOf,morphologyTier} from './config.js?v=engine-323-final';
import {claimAttackEffect} from './effects.js?v=engine-323-final';
import {distance,clearLine,segmentBoxHit,segmentCircleHit,inRearSector} from './geometry.js?v=engine-323-final';
import {stats} from './stats.js?v=engine-323-final';

// World-space projectile simulation. Every projectile is resolved in the
// deterministic combat tick; rendering reads state.projectiles without inferring hits.

export function spawnProjectileVolley(state,u,t,st,aimAngle=null,attackId=null,followthroughBonus=false){
 const count=Math.min(st.projectiles,9),spacing=.22;
 const angle=aimAngle??Math.atan2(t.y-u.y,t.x-u.x);
 const volley={hitIds:new Set(),attackId:attackId??state.nextAttackId++,origin:{x:u.x,y:u.y},direction:angle,followthroughBonus};
 state.projectiles ||= [];
 for(let i=0;i<count;i++){
  const offset=i===0?0:(i%2?1:-1)*Math.ceil(i/2)*spacing;
  const heading=angle+offset;
  u.combatStats&&(u.combatStats.shots++);if(u.chassis.mods.velocity)measure(state,u,'velocity','projectilesLaunched');
  state.projectiles.push({
   id:state.nextProjectileId++,owner:u.owner,source:u,aimedAtId:t.id,lane:i,landedCount:0,
   x:u.x,y:u.y,vx:Math.cos(heading),vy:Math.sin(heading),
   speed:PROJECTILE_SPEED*(1+.25*(u.chassis.mods.velocity||0)),bounces:Math.min(2,u.chassis.mods.ricochet||0),remaining:st.range,originalRange:st.range,segmentDistance:0,distanceTraveled:0,radius:PROJECTILE_RADIUS+Math.max(0,st.area)*3,damage:st.damage,
   knockback:st.knockback,taunt:st.taunt,penetration:Math.max(0,st.piercing),
   hitIds:new Set(),volley
  });
 }
}
// Advance across the entire swept segment. Walls/arena bounds and hostile units
// compete by earliest time of impact; each target can be hit once per volley.
// At most one extra location activation of each compatible module per volley.
function applyRicochetLocationEffects(state,shot,attacks){
 const source=shot.source,mods=source.chassis.mods,volley=shot.volley;
 if(mods.hazardous&&!volley.ricochetHazard&&claimAttackEffect(source,'hazardous',volley.attackId,state.time)){
  volley.ricochetHazard=true;
  const own=state.zones.filter(z=>z.source.id===source.id);
  if(own.length>=2){const oldest=own.sort((a,b)=>a.until-b.until)[0];state.zones.splice(state.zones.indexOf(oldest),1);}
  state.zones.push({x:shot.x,y:shot.y,owner:source.owner,source,radius:18+Math.min(4,mods.hazardous)*3,dps:Math.min(10,2*mods.hazardous),until:state.time+2.5});
  measure(state,source,'ricochet','hazardActivations');
 }
 if(mods.chain&&!volley.ricochetChain){
  const target=state.units.filter(u=>u.hp>0&&u.owner!==source.owner&&!volley.hitIds.has(u.id)&&distance(u,shot)<=95&&clearLine(shot,u,state.arena)).sort((a,b)=>distance(a,shot)-distance(b,shot)||a.id-b.id)[0];
  if(target){
   volley.ricochetChain=true;volley.hitIds.add(target.id);
   const fraction=Math.min(.6,.15*mods.chain),redirected=shot.damage*fraction;
   const damage=Math.max(0,shot.damage-stats(target).defense)*fraction;
   attacks.push({source,target,rawDamage:redirected,damage,secondary:true,attackId:volley.attackId,moduleDamage:{chain:damage}});
   state.visualEvents.push({kind:'chain',x:shot.x,y:shot.y,toX:target.x,toY:target.y,owner:source.owner});
   measure(state,source,'ricochet','chainActivations');
   measure(state,source,'ricochet','chainAuxiliaryRaw',redirected);
  }
 }
}
export function advanceProjectiles(state,dt,attacks=[]){
 if(!state.projectiles?.length||dt<=0)return attacks;
 const remaining=[];
 for(const shot of state.projectiles){
  let frameTravel=shot.speed*dt;
  let travel=Math.min(frameTravel,shot.remaining);
  let active=true,iterations=0;
  while(active&&travel>1e-7&&iterations++<state.units.length+state.arena.obstacles.length+3){
   const from={x:shot.x,y:shot.y};
   const to={x:from.x+shot.vx*travel,y:from.y+shot.vy*travel};
   let collision=null;
   const consider=(time,kind,unit=null,wall=null,pad=0)=>{
    if(time===null||time<0||time>1)return;
    if(!collision||time<collision.time-1e-8||
      (Math.abs(time-collision.time)<=1e-8&&kind==='wall')){
     collision={time,kind,unit,wall,pad};
    }
   };
   for(const o of state.arena.obstacles)consider(segmentBoxHit(from,to,o,shot.radius),'wall',null,o,shot.radius);
   // The enclosed arena's playable boundary also absorbs outgoing shots.
   const limits=[{x:20,y:0,w:0,h:520},{x:700,y:0,w:0,h:520},
                 {x:0,y:20,w:720,h:0},{x:0,y:500,w:720,h:0}];
   for(const o of limits)consider(segmentBoxHit(from,to,o,0),'wall',null,o,0);
   for(const enemy of state.units){
    if(enemy.hp<=0||enemy.owner===shot.owner||shot.hitIds.has(enemy.id))continue;
    consider(segmentCircleHit(from,to,enemy,radiusOf(enemy)+shot.radius),'unit',enemy);
   }
   const fraction=collision?collision.time:1;
   const moved=travel*fraction;
   shot.x=from.x+shot.vx*moved;shot.y=from.y+shot.vy*moved;
   shot.remaining-=moved;shot.distanceTraveled=(shot.distanceTraveled||0)+moved;shot.segmentDistance=(shot.segmentDistance||0)+moved;frameTravel-=moved;travel-=moved;
   if(!collision){active=shot.remaining>1e-7;break}
   if(collision.kind==='wall'){
    shot.source.combatStats&&(shot.source.combatStats.wallHits++);
    state.visualEvents.push({kind:'wallImpact',x:shot.x,y:shot.y,owner:shot.owner});
    if(shot.bounces>0&&collision.wall){
     const o=collision.wall,p=collision.pad;
     const sides=[{d:Math.abs(shot.x-(o.x-p)),axis:'x'},{d:Math.abs(shot.x-(o.x+o.w+p)),axis:'x'},{d:Math.abs(shot.y-(o.y-p)),axis:'y'},{d:Math.abs(shot.y-(o.y+o.h+p)),axis:'y'}].sort((a,b)=>a.d-b.d);
     if(sides[0].axis==='x')shot.vx*=-1;else shot.vy*=-1;
     shot.bounces--;
     const renewed=shot.originalRange??stats(shot.source).range;
     measure(state,shot.source,'ricochet','bounces');
     measure(state,shot.source,'ricochet','renewedTravelAllowance',Math.max(0,renewed-shot.remaining));
     shot.remaining=renewed;shot.segmentDistance=0;shot.bounced=true;
     applyRicochetLocationEffects(state,shot,attacks);
     const epsilon=Math.min(.001,shot.remaining);
     shot.x+=shot.vx*epsilon;shot.y+=shot.vy*epsilon;shot.remaining-=epsilon;shot.segmentDistance+=epsilon;
     frameTravel=Math.max(0,frameTravel-epsilon);travel=Math.min(frameTravel,shot.remaining);
     continue;
    }
    active=false;break;
   }
   const victim=collision.unit;
   shot.hitIds.add(victim.id);
   if(!shot.volley.hitIds.has(victim.id)){
    shot.volley.hitIds.add(victim.id);
    const deliveredBy=[];
    if(shot.source.chassis.mods.range>0&&
       shot.segmentDistance>CHASSIS[shot.source.type].range*(1+.06*morphologyTier(shot.source)))deliveredBy.push('range');
    if(shot.source.chassis.mods.area>0&&
       distance(shot,victim)>radiusOf(victim)+PROJECTILE_RADIUS+1e-6)deliveredBy.push('area');
    if(shot.lane>0)deliveredBy.push('projectiles');
    if(shot.landedCount>0&&shot.source.chassis.mods.piercing>0)deliveredBy.push('piercing');
    shot.landedCount++;if(shot.bounced)measure(state,shot.source,'ricochet','postBounceContacts');if(shot.source.chassis.mods.velocity){measure(state,shot.source,'velocity','projectileContacts');measure(state,shot.source,'velocity','nominalTravelSecondsSaved',shot.distanceTraveled/PROJECTILE_SPEED-shot.distanceTraveled/shot.speed);}
    if(shot.source.combatStats&&victim.id!==shot.aimedAtId)shot.source.combatStats.interceptions++;
    attacks.push({source:shot.source,target:victim,projectile:true,attackId:shot.volley.attackId,followthroughBonus:!!shot.volley.followthroughBonus,
     attackOrigin:shot.volley.origin,attackDirection:shot.volley.direction,postBounce:!!shot.bounced,
     rearHit:inRearSector(victim,-shot.vx,-shot.vy),
      rawDamage:shot.damage,damage:Math.max(1,shot.damage-stats(victim).defense),
     knockback:shot.knockback,taunt:shot.taunt,deliveredBy});
   }
   state.visualEvents.push({kind:'impact',x:shot.x,y:shot.y,owner:shot.owner});
   if(shot.penetration<=0){active=false;break}
   shot.penetration--;
   // Continue the residual segment, with the same collider excluded.
  }
  if(active&&shot.remaining>1e-7)remaining.push(shot);
 }
 state.projectiles=remaining;
 return attacks;
}
