// Engine subsystem: geometry. See AGENTS.md for ownership and test routes.
import {ARENAS,CHASSIS,radiusOf} from './config.js?v=engine-360-r4';

export function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
// Game-token rear sector: 70 degrees centered opposite facing.
export function inRearSector(target,dx,dy){
 if(!Number.isFinite(target.facing)||Math.hypot(dx,dy)<1e-8)return false;
 const delta=Math.atan2(Math.sin(Math.atan2(dy,dx)-target.facing-Math.PI),Math.cos(Math.atan2(dy,dx)-target.facing-Math.PI));
 return Math.abs(delta)<=35*Math.PI/180+1e-9;
}
export function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
export function rectHit(x,y,r,o){return Math.hypot(x-clamp(x,o.x,o.x+o.w),y-clamp(y,o.y,o.y+o.h))<r}
export function bound(u,arena=ARENAS[0]){const r=radiusOf(u)+3;u.x=clamp(u.x,20+r,700-r);u.y=clamp(u.y,20+r,500-r);for(const o of arena.obstacles){if(!rectHit(u.x,u.y,r,o))continue;const cx=clamp(u.x,o.x,o.x+o.w),cy=clamp(u.y,o.y,o.y+o.h);let dx=u.x-cx,dy=u.y-cy,d=Math.hypot(dx,dy);if(d<.0001){const sides=[{v:Math.abs(u.x-o.x),x:o.x-r,y:u.y},{v:Math.abs(u.x-(o.x+o.w)),x:o.x+o.w+r,y:u.y},{v:Math.abs(u.y-o.y),x:u.x,y:o.y-r},{v:Math.abs(u.y-(o.y+o.h)),x:u.x,y:o.y+o.h+r}].sort((a,b)=>a.v-b.v);u.x=sides[0].x;u.y=sides[0].y}else{u.x=cx+dx/d*(r+.01);u.y=cy+dy/d*(r+.01)}u.x=clamp(u.x,20+r,700-r);u.y=clamp(u.y,20+r,500-r)}}
export function segmentRect(a,b,o,pad=0){const dx=b.x-a.x,dy=b.y-a.y;let lo=0,hi=1;for(const [p,q] of [[-dx,a.x-(o.x-pad)],[dx,o.x+o.w+pad-a.x],[-dy,a.y-(o.y-pad)],[dy,o.y+o.h+pad-a.y]]){if(Math.abs(p)<1e-9){if(q<0)return false;continue}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false}return true}
export function clearLine(a,b,arena=ARENAS[0],pad=0){return !arena.obstacles.some(o=>segmentRect(a,b,o,pad))}

export function segmentCircleHit(a,b,center,radius){
 const dx=b.x-a.x,dy=b.y-a.y,fx=a.x-center.x,fy=a.y-center.y;
 const aa=dx*dx+dy*dy,cc=fx*fx+fy*fy-radius*radius;
 if(cc<=0)return 0;
 if(aa<1e-12)return null;
 const bb=2*(fx*dx+fy*dy),disc=bb*bb-4*aa*cc;
 if(disc<0)return null;
 const t=(-bb-Math.sqrt(disc))/(2*aa);
 return t>=0&&t<=1?t:null;
}
export function segmentBoxHit(a,b,o,pad=0){
 const dx=b.x-a.x,dy=b.y-a.y;
 let near=0,far=1;
 for(const [start,velocity,lo,hi] of [
  [a.x,dx,o.x-pad,o.x+o.w+pad],[a.y,dy,o.y-pad,o.y+o.h+pad]
 ]){
  if(Math.abs(velocity)<1e-9){if(start<lo||start>hi)return null;continue}
  const t1=(lo-start)/velocity,t2=(hi-start)/velocity;
  near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));
  if(near>far)return null;
 }
 return near>=0&&near<=1?near:null;
}
