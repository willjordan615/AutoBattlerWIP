// Engine subsystem: followthrough. See AGENTS.md for ownership and test routes.
import {resolveCollision} from './collision.js?v=engine-350-r1';
import {stats} from './stats.js?v=engine-350-r1';
import {radiusOf} from './config.js?v=engine-350-r1';
import {startAttack,advanceAttack,attackWindup} from './combat.js?v=engine-350-r1';
import {bound,distance,clearLine,rectHit} from './geometry.js?v=engine-350-r1';

// Destination-based movement. A bounded commitment prefers the opposite side
// at two copies, and never moves through terrain or unrelated units.
function destination(state,u,target,heading,farSide,budget){
 const r=radiusOf(u)+3,gap=radiusOf(u)+radiusOf(target)+5;
 const near=Math.atan2(u.y-target.y,u.x-target.x);
 const angles=farSide?[heading,heading+.45,heading-.45,heading+Math.PI/2,heading-Math.PI/2,near]:[near,near+.65,near-.65,near+1.1,near-1.1];
 for(const a of angles){
  const p={x:target.x+Math.cos(a)*gap,y:target.y+Math.sin(a)*gap};
  if(distance(u,p)<2||distance(u,p)>budget+1e-6||p.x<20+r||p.x>700-r||p.y<20+r||p.y>500-r)continue;
  if(!clearLine(u,p,state.arena)||state.arena.obstacles.some(o=>rectHit(p.x,p.y,r,o)))continue;
  if(state.units.some(v=>v!==u&&v!==target&&v.hp>0&&distance(p,v)<radiusOf(u)+radiusOf(v)+5))continue;
  return {angle:a,point:p};
 }
 return null;
}
export function applyFollowthrough(state,hit){
 const u=hit.source,target=hit.target;
 if(hit.followthroughBonus||!u?.chassis?.mods?.followthrough||!target||u.hp<=0||target.hp<=0)return false;
 if(u.followthroughAt>state.time+1e-8||u.followthroughCommit?.until>state.time)return false;
 if(hit.attackId!=null&&u.lastFollowthroughAttackId===hit.attackId)return false;
 const origin=hit.attackOrigin||{x:u.x,y:u.y};
 const heading=hit.attackDirection??Math.atan2(target.y-origin.y,target.x-origin.x);
 const stacks=Math.min(3,Math.max(0,u.chassis.mods.followthrough-1)),speedFactor=1.6+stacks*.45;
 const duration=.75,choice=destination(state,u,target,heading,stacks>0,stats(u).speed*speedFactor*duration);
 if(!choice)return false;
 const d=distance(u,choice.point);
 const startDistance=distance(u,target);
 const entryX=startDistance>1e-8?(u.x-target.x)/startDistance:0;
 const entryY=startDistance>1e-8?(u.y-target.y)/startDistance:0;
 u.followthroughCommit={x:(choice.point.x-u.x)/d,y:(choice.point.y-u.y)/d,
  until:state.time+duration,started:state.time,attackId:hit.attackId,
  speedFactor,phaseTargetId:stacks>0?target.id:null,targetId:target.id,landingAngle:choice.angle,
  entryX,entryY,startX:u.x,startY:u.y};
 if(u.chassis.mods.disengage&&u.disengageUntil>state.time)u.disengageUntil=state.time+duration+.5;
 u.followthroughAt=state.time+1;u.lastFollowthroughAttackId=hit.attackId;
 u.navigation=null;u.navProgress=null;
 u.combatStats&&(u.combatStats.followthrough=(u.combatStats.followthrough||0)+1);
 state.visualEvents.push({kind:'reaction',ability:'followthrough',x:u.x,y:u.y,owner:u.owner});
 return true;
}
export function advanceFollowthrough(state,u,dt){
 const c=u.followthroughCommit;
 if(!c||c.until<=state.time-dt||c.arrived)return false;
 const target=state.units.find(v=>v.id===c.targetId&&v.hp>0);
 if(!target){c.until=state.time-dt;return false;}
 const gap=radiusOf(u)+radiusOf(target)+5,p={x:target.x+Math.cos(c.landingAngle)*gap,y:target.y+Math.sin(c.landingAngle)*gap};
 const d=distance(u,p),active=Math.min(dt,Math.max(0,c.until-(state.time-dt))),step=Math.min(d,stats(u).speed*c.speedFactor*active);
 if(d<1e-7){c.arrived=true;return false;}
 const before={x:u.x,y:u.y};c.x=(p.x-u.x)/d;c.y=(p.y-u.y)/d;
 u.followthroughStepStart=before;
 const next={x:u.x+c.x*step,y:u.y+c.y*step},r=radiusOf(u)+3;
 if(!clearLine(u,next,state.arena)||next.x<20+r||next.x>700-r||next.y<20+r||next.y>500-r||state.arena.obstacles.some(o=>rectHit(next.x,next.y,r,o))){c.until=state.time;return true;}
 u.x=next.x;u.y=next.y;
 if(step>=d-1e-7)c.arrived=true;
 if(state.diagnostics){state.diagnostics.followthroughAttempted=(state.diagnostics.followthroughAttempted||0)+step;state.diagnostics.followthroughMoved=(state.diagnostics.followthroughMoved||0)+distance(before,u);}
 if(distance(before,u)>1e-6)state.visualEvents.push({kind:'mobility',ability:'followthrough',owner:u.owner,x:before.x,y:before.y,toX:u.x,toY:u.y});
 return true;
}
// Called after ordinary collision resolution; no reward for an obstructed move.
export function finishFollowthrough(state,u,attacks){
 const c=u.followthroughCommit;if(!c||(!c.arrived&&c.until>state.time))return false;
 const t=state.units.find(v=>v.id===c.targetId&&v.hp>0);
 const adjacent=t&&Math.abs(distance(u,t)-(radiusOf(u)+radiusOf(t)+5))<=3&&clearLine(u,t,state.arena);
 if(u.chassis.mods.disengage&&u.disengageUntil>state.time)u.disengageUntil=state.time+.5;
 u.followthroughCommit=null;
 // The destination must be on the opposite side of the original relative bearing.
 // Sideways or near-side arrival, even if valid, does not qualify.
 const gap=t?radiusOf(u)+radiusOf(t)+5:0;
 const farSide=t&&(u.x-t.x)*c.entryX+(u.y-t.y)*c.entryY < -gap*.5;
 const traversed=-(u.x-c.startX)*c.entryX-(u.y-c.startY)*c.entryY>=gap*.5;
 if(!adjacent||!c.arrived||!farSide||!traversed||u.hp<=0||
    u.lastFollowthroughBonusTargetId===t.id||u.followthroughBonusAt>state.time+1e-8)return false;
 const prior=u.attack,cd=u.cd;
 u.attack=null;u.cd=0;
 if(startAttack(state,u,t)){u.attack.followthroughBonus=true;advanceAttack(state,u,t,stats(u),attackWindup(u),attacks);}
 u.attack=prior;u.cd=cd;u.followthroughBonusAt=state.time+1;
 u.lastFollowthroughBonusTargetId=t.id;
 if(u.combatStats)u.combatStats.followthroughBonus=(u.combatStats.followthroughBonus||0)+1;
 return true;
}

// One destination per committed attack. Depth is projected along the attack's
// original direction; tie-breaking is stable and independent of processing order.
export function followthroughDepth(hit){
 const origin=hit.attackOrigin||{x:hit.source.x,y:hit.source.y};
 const direction=hit.attackDirection??Math.atan2(hit.target.y-origin.y,hit.target.x-origin.x);
 return (hit.target.x-origin.x)*Math.cos(direction)+(hit.target.y-origin.y)*Math.sin(direction);
}
export function resolveFollowthroughImpacts(state,attacks){
 const pending=state.followthroughPending||(state.followthroughPending=new Map());
 const immediate=new Map();
 for(const hit of attacks){
  if(hit.followthroughBonus||hit.secondary||hit.indirect||hit.damage<=0||!hit.source?.chassis?.mods?.followthrough)continue;
  const key=hit.attackId??-1-hit.source.id;
  const store=hit.projectile?pending:immediate;
  const existing=store.get(key);
  const depth=followthroughDepth(hit);
  if(!existing||depth>existing.depth+1e-8||
     (Math.abs(depth-existing.depth)<1e-8&&hit.target.id<existing.hit.target.id))
   store.set(key,{hit,depth});
 }
 for(const {hit} of immediate.values())applyFollowthrough(state,hit);
 // Projectiles may hit targets over several frames, so wait until a volley
 // finishes before deciding which successful hit is deepest.
 const active=new Set((state.projectiles||[]).map(p=>p.volley.attackId));
 for(const [key,entry] of pending){
  if(active.has(key))continue;
  applyFollowthrough(state,entry.hit);
  pending.delete(key);
 }
}
