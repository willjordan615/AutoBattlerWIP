// Engine subsystem: followthrough. See AGENTS.md for ownership and test routes.
import {resolveCollision} from './collision.js?v=engine-321';
import {stats} from './stats.js?v=engine-321';
import {bound,distance} from './geometry.js?v=engine-321';

// An Impact module: displace the attacker after the first landed hit of a
// release. Phasing bypasses only that target's body blocking, never terrain.
// A successful hit establishes a short, speed-scaled *movement commitment*.
// No immediate relocation. All overlaps are negotiated by resolveCollision.
export function applyFollowthrough(state,hit){
 const u=hit.source,target=hit.target;
 if(!u?.chassis?.mods?.followthrough||!target||u.hp<=0)return false;
 if(u.followthroughAt>state.time+1e-8)return false;
 if(hit.attackId!=null&&u.lastFollowthroughAttackId===hit.attackId)return false;
 const origin=hit.attackOrigin||{x:u.x,y:u.y};
 const heading=hit.attackDirection??Math.atan2(target.y-origin.y,target.x-origin.x);
 const stacks=Math.min(3,Math.max(0,u.chassis.mods.followthrough-1));
 const duration=.5+stacks*.25;
 u.followthroughCommit={x:Math.cos(heading),y:Math.sin(heading),
  until:state.time+duration,started:state.time,attackId:hit.attackId,
  speedFactor:1+stacks*.30,phaseTargetId:stacks>0?target.id:null};
 // If both attack effects are equipped, complete the space-claim first,
 // then give Disengage its full independent retreat window.
 if(u.chassis.mods.disengage&&u.disengageUntil>state.time)
  u.disengageUntil=state.time+duration+.5;
 u.followthroughAt=state.time+Math.max(.75,duration);
 u.lastFollowthroughAttackId=hit.attackId;
 u.navigation=null;u.navProgress=null;
 u.combatStats&&(u.combatStats.followthrough=(u.combatStats.followthrough||0)+1);
 state.visualEvents.push({kind:'reaction',ability:'followthrough',
  x:u.x,y:u.y,owner:u.owner});
 return true;
}
export function advanceFollowthrough(state,u,dt){
 const commit=u.followthroughCommit;
 if(!commit||commit.until<=state.time-dt)return false;
 const active=Math.min(dt,Math.max(0,commit.until-(state.time-dt)));
 if(active<=0)return false;
 const st=stats(u),step=st.speed*commit.speedFactor*active;
 const before={x:u.x,y:u.y};
 u.followthroughStepStart=before;
 u.x+=commit.x*step;u.y+=commit.y*step;
 bound(u,state.arena);
 if(state.diagnostics){
  state.diagnostics.followthroughAttempted=(state.diagnostics.followthroughAttempted||0)+step;
  state.diagnostics.followthroughMoved=(state.diagnostics.followthroughMoved||0)+distance(before,u);
 }
 if(distance(before,u)>1e-6)state.visualEvents.push({kind:'mobility',
  ability:'followthrough',owner:u.owner,x:before.x,y:before.y,toX:u.x,toY:u.y});
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
  if(hit.secondary||hit.indirect||hit.damage<=0||!hit.source?.chassis?.mods?.followthrough)continue;
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
