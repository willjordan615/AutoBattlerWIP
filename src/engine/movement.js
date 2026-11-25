// Engine subsystem: movement. See AGENTS.md for ownership and test routes.
import {CHASSIS} from './config.js?v=balance-312';
import {clearLine,distance,rectHit,clamp} from './geometry.js?v=balance-312';
import {actorClearance,navigationPath} from './navigation.js?v=balance-312';
import {cooperativeEngagement,positionScore,holdingOpportunity} from './positioning.js?v=balance-312';
import {measure} from './telemetry.js?v=balance-312';

export function chooseMovement(state,u,target,st,enemies,dt){
 u.previouslyHolding=!!u.holdingPosition;u.holdingPosition=false;
 u.supportingAlly=null;u.supportMode=null;
 const arena=state.arena,step=st.speed*dt,r=CHASSIS[u.type].radius+3;
 const terrainBlocked=!clearLine(u,target,arena,0);
 const routeBlocked=terrainBlocked||(distance(u,target)>st.range&&!clearLine(u,target,arena,r));
 const actorPressure=actorClearance(state,u,u,dt);
 u.navigationBlocked=routeBlocked;u.navigationActorPressure=actorPressure;
 let nav=u.navigation;
 const hasGoal=routeBlocked||distance(u,target)>Math.min(st.range*.85,st.range-5);
 const teamSupport=cooperativeEngagement(state,u,st,enemies);
 // A direct attack position needs no terrain route. Tactical movement is free to
 // choose a preferred range, provided no terrain detour is being completed.
 if(nav&&!terrainBlocked&&distance(u,target)<=st.range){u.navigation=null;u.navProgress=null;nav=null;u.navNextPlanTime=state.time+.35}
 if(nav&&nav.path.length){
  while(nav.path.length>1&&distance(u,nav.path[0])<Math.max(7,step*1.5))nav.path.shift();
  // Skip only if terrain visibility genuinely makes a later waypoint reachable.
  for(let i=nav.path.length-1;i>0;i--){
   if(clearLine(u,nav.path[i],arena,r)){nav.path.splice(0,i);break}
  }
 }
 // Progress is the remaining route length, not net displacement. Reversals,
 // orbiting and repeated corner visits cannot masquerade as forward progress.
 const remaining=route=>route.path.reduce((sum,p,i)=>sum+distance(i?route.path[i-1]:u,p),0);
 if(nav){
  const length=remaining(nav);
  const tracker=u.navProgress||(u.navProgress={time:state.time,best:length,failures:0});
  if(state.time-tracker.time>=.7){
   if(length>tracker.best-Math.max(3,st.speed*.08))tracker.failures++;
   else tracker.failures=0;
   tracker.best=length;tracker.time=state.time;
   if(tracker.failures>=2){
    u.navStuckCount=(u.navStuckCount||0)+1;
    u.navAlternate=(u.navAlternate||0)+1;
    u.navigation=null;nav=null;u.navProgress=null;
   }
  }
 }
 const refresh=nav&&(nav.targetId!==target.id||distance(nav.targetPosition,target)>Math.max(105,st.range*.8));
 if(refresh){nav=null;u.navigation=null;u.navProgress=null}
 // An active detour is sticky: temporary actors and small target motion never
 // change the side of the obstacle being traversed.
 if(!nav&&routeBlocked&&hasGoal&&state.time>=(u.navNextPlanTime||0)){
  u.navNextPlanTime=state.time+.4;
  const ideal=Math.max(st.radius+CHASSIS[target.type].radius+4,st.range*.78);
  const points=[];
  for(let i=0;i<16;i++){
   const angle=i*Math.PI/8;
   for(const scale of [1, .75])points.push({x:target.x+Math.cos(angle)*ideal*scale,y:target.y+Math.sin(angle)*ideal*scale});
  }
  // Include an approach close to the target for melee against obstacles.
  points.push({x:target.x,y:target.y});
  let chosen=null,best=-Infinity;
  for(const p of points){
   if(p.x<20+r||p.x>700-r||p.y<20+r||p.y>500-r)continue;
   if(arena.obstacles.some(o=>rectHit(p.x,p.y,r+1,o)))continue;
   if(!clearLine(p,target,arena,0))continue;
   const route=navigationPath(u,p,arena,r);
   if(!route)continue;
   const length=route.reduce((sum,node,i)=>sum+distance(i?route[i-1]:u,node),0);
   // Distance is meaningful to avoid massive detours; a clear firing line
   // and tactical positioning still determine the final destination.
   const score=positionScore(state,u,target,p,st,enemies)-length*.008;
   if(score>best){best=score;chosen={targetId:target.id,targetPosition:{x:target.x,y:target.y},destination:p,path:route}}
  }
  if(chosen){nav=chosen;u.navigation=nav;u.navProgress={time:state.time,best:remaining(nav),failures:0}}
 }
 // Independent collision-deadlock detector: route progress alone cannot
 // diagnose characters pushed back by teammates or enemies in open sightlines.
 const supportingAtPosition=teamSupport&&distance(u,teamSupport.point)<Math.max(18,st.radius+10);
 const activeApproach=(distance(u,target)>st.range||terrainBlocked)&&
  !supportingAtPosition&&holdingOpportunity(state,u,target,st,enemies)===0;
 const motion=u.navMotion||(u.navMotion={x:u.x,y:u.y,time:state.time,stalls:0});
 if(state.time-motion.time>=.65){
  const displaced=distance(u,motion);
  if(activeApproach&&displaced<Math.max(4,st.speed*.07))motion.stalls++;
  else motion.stalls=0;
  motion.x=u.x;motion.y=u.y;motion.time=state.time;
  if(motion.stalls>=2){
   motion.stalls=0;
   const heading=Math.atan2(target.y-u.y,target.x-u.x);
   const sign=(u.id+Math.floor(state.time))%2?1:-1;
   const side=heading+sign*Math.PI/2;
   // Choose an accessible side step rather than following the same blocked
   // forward instruction. Different unit IDs break symmetric traffic jams.
   const options=[side,side+Math.PI,heading+sign*2.2,heading-sign*2.2];
   for(const a of options){
    const p={x:clamp(u.x+Math.cos(a)*Math.max(35,st.radius*3),20+r,700-r),
             y:clamp(u.y+Math.sin(a)*Math.max(35,st.radius*3),20+r,500-r)};
    if(!arena.obstacles.some(o=>rectHit(p.x,p.y,r,o))&&clearLine(u,p,arena,r)){
     u.localEscape={point:p,until:state.time+1.4};
     u.navStuckCount=(u.navStuckCount||0)+1;
     break;
    }
   }
  }
 }
 const valid=(dir)=>{
  const p={x:u.x+dir.x*step,y:u.y+dir.y*step};
  return p.x>=20+r&&p.x<=700-r&&p.y>=20+r&&p.y<=500-r
   &&clearLine(u,p,arena,0)&&arena.obstacles.every(o=>!rectHit(p.x,p.y,r,o));
 };
 const steer=(goal,committed=false)=>{
  const angle=Math.atan2(goal.y-u.y,goal.x-u.x);
  const offsets=[0,.22,-.22,.45,-.45,.8,-.8,1.2,-1.2,1.57,-1.57,2.35,-2.35,Math.PI];
  let selected=null,best=-Infinity;
  for(const offset of offsets){
   const dir={x:Math.cos(angle+offset),y:Math.sin(angle+offset)};
   if(!valid(dir))continue;
   const p={x:u.x+dir.x*step,y:u.y+dir.y*step};
   const forward=(distance(u,goal)-distance(p,goal))/Math.max(step,.001);
   const pressure=actorClearance(state,u,p,dt*.8);
   // Keep forward movement dominant except when immediately colliding.
   const score=forward*3-pressure*.07+(committed?0:positionScore(state,u,target,p,st,enemies)*.02);
   if(score>best){best=score;selected={...dir,score}}
  }
  return selected;
 };
 // Idle teammates may position around a real ally engagement instead of
 // waiting at an unrelated location. Reuse the same terrain graph and local
 // collision-aware steering; do not teleport or force target selection.
 const support=teamSupport;
 if(support&&!u.localEscape){
  const goal=support.point;
  let route=u.supportNavigation;
  if(!route||route.enemyId!==support.enemyId||route.allyId!==support.allyId||
     state.time>route.until||distance(route.goal,goal)>24){
   const path=navigationPath(u,goal,arena,r);
   route=path?{allyId:support.allyId,enemyId:support.enemyId,goal,
    path,until:state.time+.45}:null;
   u.supportNavigation=route;
  }
  if(route){
   const waypoint=route.path.find(p=>distance(u,p)>Math.max(7,step*1.5));
   u.supportingAlly=support.allyId;u.supportMode=support.mode;
   if(!waypoint||distance(u,goal)<Math.max(18,st.radius+10)){
    u.holdingPosition=true;u.navigation=null;u.navProgress=null;
    return {x:0,y:0};
   }
   const direction=steer(waypoint,true);
   if(direction){
    u.navigation=null;u.navProgress=null;
    return {x:direction.x,y:direction.y};
   }
  }
 }else u.supportNavigation=null;
 if(u.localEscape){
  if(state.time>u.localEscape.until||distance(u,u.localEscape.point)<Math.max(7,step*2)){u.localEscape=null}
  else{
   const direction=steer(u.localEscape.point,true);
   if(direction)return direction;
   u.localEscape=null;
  }
 }
 if(nav&&nav.path.length){
  const waypoint=nav.path[0];
  if(distance(u,waypoint)<Math.max(7,step*1.5)&&nav.path.length===1){
   u.navigation=null;u.navProgress=null;nav=null;
  }else{
   const direction=steer(waypoint,true);
   if(direction)return direction;
   // Terrain graph may be obsolete after forced collision displacement.
   u.navigation=null;u.navProgress=null;nav=null;
  }
 }
 // If pathfinding cannot start, try reachable corners, committing to one.
 if(routeBlocked&&hasGoal&&!nav&&state.time>=(u.navNextPlanTime||0)){
  u.navNextPlanTime=state.time+.4;
  const corners=arena.obstacles.flatMap(o=>[
   {x:o.x-r-6,y:o.y-r-6},{x:o.x+o.w+r+6,y:o.y-r-6},
   {x:o.x-r-6,y:o.y+o.h+r+6},{x:o.x+o.w+r+6,y:o.y+o.h+r+6}
  ]).filter(p=>p.x>20+r&&p.x<700-r&&p.y>20+r&&p.y<500-r);
  const options=corners.map(p=>({p,route:navigationPath(u,p,arena,r)})).filter(x=>x.route);
  options.sort((a,b)=>distance(a.p,target)+distance(u,a.p)-distance(b.p,target)-distance(u,b.p));
  if(options.length){
   const choice=options[(u.navAlternate||0)%Math.min(2,options.length)];
   u.navigation={targetId:target.id,targetPosition:{x:target.x,y:target.y},destination:choice.p,path:choice.route};
   u.navProgress={time:state.time,best:remaining(u.navigation),failures:0};
   const dir=steer(choice.route[0],true);if(dir)return dir;
  }
 }
 // Free movement: tactical scores choose positions; local actors only penalize
 // immediate overlaps and do not trigger expensive global replanning.
 const angle=Math.atan2(target.y-u.y,target.x-u.x);
 const candidates=[{x:0,y:0}];
 for(let i=0;i<16;i++){const a=angle+i*Math.PI/8;candidates.push({x:Math.cos(a),y:Math.sin(a)})}
 const holdValue=holdingOpportunity(state,u,target,st,enemies);
 let best={x:0,y:0,score:-Infinity};
 for(const dir of candidates){
  if((dir.x||dir.y)&&!valid(dir))continue;
  const p={x:u.x+dir.x*step,y:u.y+dir.y*step};
  const pressure=actorClearance(state,u,p,dt*.8);
  const progress=distance(u,target)-distance(p,target);
  const score=positionScore(state,u,target,p,st,enemies)-pressure*.09
   +(hasGoal?progress*.09:0)+(!(dir.x||dir.y)?holdValue:0);
  if(score>best.score+1e-8)best={...dir,score};
 }
 u.holdingPosition=!(best.x||best.y)&&holdValue>0;
 if(state.moduleTelemetry&&u.chassis.mods.patience&&u.holdingPosition)measure(state,u,'patience',distance(u,target)<=st.range&&clearLine(u,target,state.arena)?'holdWithAttackAccessSeconds':'holdAwaitingApproachSeconds',dt);
 if(u.holdingPosition){
  u.navProgress=null;u.navMotion={x:u.x,y:u.y,time:state.time,stalls:0};
 }
 return {x:best.x,y:best.y};
}
