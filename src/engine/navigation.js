// Engine subsystem: navigation. See AGENTS.md for ownership and test routes.
import {segmentRect,rectHit,clamp,clearLine,distance} from './geometry.js?v=balance-312';
import {stats} from './stats.js?v=balance-312';
import {CHASSIS} from './config.js?v=balance-312';

// Exact physical clearance is used only to connect a chassis already hugging
// a corner to the stable terrain graph. Ordinary graph edges remain conservative.
export function physicalLineClear(a,b,arena,r){
 for(const o of arena.obstacles){
  if(segmentRect(a,b,o))return false;
  if(rectHit(a.x,a.y,r,o)||rectHit(b.x,b.y,r,o))return false;
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  for(const corner of [{x:o.x,y:o.y},{x:o.x+o.w,y:o.y},
    {x:o.x,y:o.y+o.h},{x:o.x+o.w,y:o.y+o.h}]){
   const t=length?clamp(((corner.x-a.x)*dx+(corner.y-a.y)*dy)/length,0,1):0;
   if(Math.hypot(a.x+dx*t-corner.x,a.y+dy*t-corner.y)<r)return false;
  }
 }
 return true;
}
export function navigationPath(start,end,arena,r,viaPenalty=0){
 const margin=4;
 const corners=arena.obstacles.flatMap(o=>[
  {x:o.x-r-margin,y:o.y-r-margin},{x:o.x+o.w+r+margin,y:o.y-r-margin},
  {x:o.x-r-margin,y:o.y+o.h+r+margin},{x:o.x+o.w+r+margin,y:o.y+o.h+r+margin}
 ]).filter(p=>p.x>=20+r&&p.x<=700-r&&p.y>=20+r&&p.y<=500-r
   &&arena.obstacles.every(o=>!rectHit(p.x,p.y,r+1,o)));
 const nodes=[start,...corners,end],n=nodes.length,dist=Array(n).fill(Infinity),prev=Array(n).fill(-1),seen=Array(n).fill(false);
 const legal=(p,q,first=false)=>clearLine(p,q,arena,r)||(first&&physicalLineClear(p,q,arena,r));
 if(legal(start,end,true))return [end];
 dist[0]=0;
 for(let k=0;k<n;k++){
  let at=-1;for(let i=0;i<n;i++)if(!seen[i]&&(at===-1||dist[i]<dist[at]))at=i;
  if(at<0||!Number.isFinite(dist[at])||at===n-1)break;
  seen[at]=true;
  for(let j=1;j<n;j++){
   if(seen[j]||!legal(nodes[at],nodes[j],at===0))continue;
   const candidate=dist[at]+distance(nodes[at],nodes[j])+(at===0&&j!==n-1?viaPenalty:0);
   if(candidate<dist[j]){dist[j]=candidate;prev[j]=at}
  }
 }
 if(!Number.isFinite(dist[n-1]))return null;
 const route=[];let at=n-1;
 while(at>0){route.unshift(nodes[at]);at=prev[at];if(at<0)return null}
 return route;
}
export function actorClearance(state,u,point,seconds=0){
 let pressure=0;
 for(const other of state.units){
  if(other===u||other.hp<=0)continue;
  const intent=other.intent||{x:0,y:0},speed=stats(other).speed;
  const projected={x:other.x+intent.x*speed*seconds,y:other.y+intent.y*speed*seconds};
  const gap=distance(point,projected)-CHASSIS[u.type].radius-CHASSIS[other.type].radius-5;
  if(gap<25)pressure+=Math.max(0,25-gap)*(other.owner===u.owner?1.3:1);
 }
 return pressure;
}

// Profile 1: local teammate-aware steering. Score proposed moves before collision resolution.
export function steerAroundAllies(state,u,desired,step){
 const allies=state.units.filter(v=>v!==u&&v.hp>0&&v.owner===u.owner);
 if(!allies.length||step<=0)return desired;
 const norm=Math.hypot(desired.x,desired.y);if(norm<1e-8)return desired;
 const base=Math.atan2(desired.y,desired.x),angles=[0,.35,-.35,.7,-.7,1.15,-1.15,1.65,-1.65,Math.PI];
 let best={x:Math.cos(base),y:Math.sin(base)},bestScore=-Infinity;
 for(const offset of angles){const dir={x:Math.cos(base+offset),y:Math.sin(base+offset)};
 const next={x:u.x+dir.x*step,y:u.y+dir.y*step};let score=dir.x*desired.x+dir.y*desired.y;
 for(const ally of allies){const radius=CHASSIS[u.type].radius+CHASSIS[ally.type].radius+9;
 const current=distance(u,ally),future=distance(next,ally);
 if(future<radius+18)score-=Math.max(0,radius+18-future)*.14;
 if(future<radius)score-=(radius-future)*4;
 if(current<radius+16&&future<current)score-=2;
 // Penalize crossing the path of a nearby ally moving in the same direction.
 if(ally.move&&current<radius+40){const projected={x:ally.x+ally.move.x*step,y:ally.y+ally.move.y*step};const separation=distance(next,projected);if(separation<radius+8)score-=(radius+8-separation)*1.5}
 }
 if(score>bestScore){bestScore=score;best=dir}
 }return best
}
