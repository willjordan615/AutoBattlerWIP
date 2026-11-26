// Engine subsystem: collision. See AGENTS.md for ownership and test routes.
import {distance,bound} from './geometry.js?v=engine-323-r1';
import {CHASSIS,radiusOf} from './config.js?v=engine-323-r1';

// A planted fighter braces; movement over the previous half second supplies
// momentum. Max HP provides mass without making damage change physics mid-fight.
export function recentMovement(u,now,window=.5){
 const points=(u.motion||[]).filter(p=>p.time>=now-window-1e-8);
 let total=0;
 for(let i=1;i<points.length;i++)total+=distance(points[i-1],points[i]);
 return total;
}
export function collisionStability(u,now){
 const pace=CHASSIS[u.type]?.speed||1;
 const traveled=recentMovement(u,now);
 const normalized=Math.min(1,traveled/Math.max(1,pace*.5));
 const brace=normalized<.1;
 return (u.maxHp||CHASSIS[u.type].hp)*(brace?1.5:1+normalized)*(u.steadfastUntil>now?1+(u.steadfastStrength||0):1);
}
export function resolveCollision(state){
 const units=state.units.filter(u=>u.hp>0);
 for(let pass=0;pass<2;pass++)for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){
  const a=units[i],b=units[j],min=radiusOf(a)+radiusOf(b)+5;
  let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d>=min-1e-6)continue;
  const phases=(u,other)=>u.followthroughCommit?.phaseTargetId===other.id&&
   (u.followthroughCommit.until>state.time||!!u.followthroughStepStart);
  if(phases(a,b)||phases(b,a))continue;
  if(d<.001){dx=a.id<b.id?1:-1;dy=0;d=1}
  const overlap=min-d,ax=dx/d,ay=dy/d;
  const sa=collisionStability(a,state.time),sb=collisionStability(b,state.time);
  const ca=a.followthroughCommit?.until>state.time?1:0;
  const cb=b.followthroughCommit?.until>state.time?1:0;
  // Ordinary navigation remains mostly cooperative. The directional
  // commitment claims space, but high stability and bracing still resist it.
  const weightA=sa*(1+ca*1.25),weightB=sb*(1+cb*1.25);
  const proportional=weightB/(weightA+weightB);
  const shareA=ca||cb?proportional:.35+.3*proportional;
  const portionA=Math.max(.1,Math.min(.9,shareA));
  const ax0=a.x,ay0=a.y,bx0=b.x,by0=b.y;
  a.x-=ax*overlap*portionA;a.y-=ay*overlap*portionA;
  b.x+=ax*overlap*(1-portionA);b.y+=ay*overlap*(1-portionA);
  bound(a,state.arena);bound(b,state.arena);
  if(state.diagnostics){
   state.diagnostics.collisions=(state.diagnostics.collisions||0)+1;
   if(ca||cb)state.diagnostics.committedCollisions=(state.diagnostics.committedCollisions||0)+1;
  }
  // Geometry may prevent the defender from yielding. Recover the residual
  // overlap without allowing either actor to move through terrain.
  const remaining=min-distance(a,b);
  if(remaining>.01){
   const moveA=distance({x:ax0,y:ay0},a),moveB=distance({x:bx0,y:by0},b);
   const winner=moveA<.01&&moveB>.01?b:moveB<.01&&moveA>.01?a:null;
   if(winner){
    const direction=winner===a?-1:1;
    winner.x+=ax*direction*remaining;winner.y+=ay*direction*remaining;
    bound(winner,state.arena);
   }
  }
 }
}
