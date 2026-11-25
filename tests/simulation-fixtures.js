import {CHASSIS,ARENAS,STEP,makeChassis,stats,bound,chooseTarget,chooseMovement,holdingOpportunity,cooperativeEngagement,positionScore,clearLine,resolveCollision,tick,spawn,placementGroups,placementDamage,resolvePlayerHP,teamPercent,advanceProjectiles,PROJECTILE_SPEED,utilityCooldown,tacticalAssessment,ATTACK_TIMING,startAttack,advanceAttack,attackMovementMultiplier,meleeAttackTargets,resolveAttackModules,targetScoreDetails,ATTACK_STAGES,claimAttackEffect,applyFollowthrough,advanceFollowthrough,UTILITY_MOVE_SCALE,recentMovement,collisionStability,disengageDirection,resolveFollowthroughImpacts} from '../src/simulation.js';
export const players=()=>Array.from({length:4},(_,i)=>({name:'P'+i,hp:100,streak:0,squad:[makeChassis(['bruiser','rogue','ranged','bruiser'][i])]}));
export function projectileFixture(arena=ARENAS[0],types=['ranged','bruiser']){
 const p=types.map((type,i)=>({name:'P'+i,hp:100,squad:[makeChassis(type)]}));
 const state=spawn(p,arena,9);
 state.units.forEach(u=>{u.x=90+u.owner*90;u.y=200});
 state.visualEvents=[];
 state.projectiles=[];
 return state;
}
export function testShot(state,source,settings={}){
 const shot={id:1,owner:source.owner,source,x:source.x,y:source.y,
  vx:settings.vx??1,vy:settings.vy??0,speed:settings.speed??PROJECTILE_SPEED,
  remaining:settings.remaining??250,radius:settings.radius??3,
  damage:settings.damage??14,knockback:0,taunt:0,penetration:settings.piercing??0,
  hitIds:new Set(),volley:{hitIds:new Set()}};
 state.projectiles.push(shot);return shot;
}
