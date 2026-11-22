// Deterministic, renderer-independent combat backend. Values are provisional balance defaults.
export const CHASSIS={
 bruiser:{name:'Bruiser',hp:155,damage:13,range:44,speed:48,rate:1.25,defense:4,radius:15,delivery:'melee',fill:'#eeb878',desc:'Durable melee frontliner'},
 rogue:{name:'Rogue',hp:105,damage:18,range:40,speed:95.45,rate:.78,defense:1,radius:11,delivery:'melee',fill:'#c2a1fa',desc:'Fast opportunistic melee'},
 ranged:{name:'Ranged',hp:80,damage:14,range:160,speed:62,rate:1.12,defense:0,radius:11,delivery:'projectile',fill:'#8ce7bd',desc:'Long-range projectile attacker'}
};
export const METRICS=['kill','damage','threat','distance','allyProximity','safety','protection','ability','isolation','preferredRange'];
export const BASE_WEIGHTS={
 bruiser:[.8,1,1.1,1.1,.9,.3,1.2,.5,.3,.7],
 rogue:[1.4,1.1,.5,.9,.2,.8,.1,.6,1.1,1],
 ranged:[.9,1,.5,.6,.2,1.4,.2,.5,.5,1.7]
};
export const ARENAS=[
 {name:'Open Arena',obstacles:[]},
 {name:'Twin Pillars',obstacles:[{x:278,y:172,w:40,h:85},{x:402,y:263,w:40,h:85}]},
 {name:'Central Barrier',obstacles:[{x:335,y:155,w:50,h:115},{x:335,y:310,w:50,h:55}]}
];
export const WIDTH=720,HEIGHT=520,STEP=1/30,DURATION=30;
export function rng(seed=12345){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
export function makeChassis(type){if(!CHASSIS[type])throw Error('Unknown chassis');return {type,mods:{hp:0,damage:0,speed:0,rate:0,range:0,projectiles:0,piercing:0,area:0,knockback:0,taunt:0,dash:0,dodge:0,backstep:0,flank:0,disengage:0,intercept:0,followthrough:0},weights:Object.fromEntries(METRICS.map((m,i)=>[m,BASE_WEIGHTS[type][i]])),passives:[],modules:[]}}
export function stats(u){const c=CHASSIS[u.type],m=u.chassis.mods;return {hp:c.hp+m.hp*20,damage:c.damage+m.damage*2,speed:(c.speed+m.speed*18)*(u.chassis.passives.includes('haste')?1.25:1),range:c.range+m.range*20,rate:c.rate/(1+m.rate*.15)/(u.chassis.passives.includes('focus')?1.15:1),defense:c.defense+(u.chassis.passives.includes('bulwark')?3:0),radius:c.radius,projectiles:1+m.projectiles,piercing:m.piercing,area:m.area,knockback:m.knockback,taunt:m.taunt||0,dash:m.dash||0,dodge:m.dodge||0,backstep:m.backstep||0,flank:m.flank||0,disengage:m.disengage||0,intercept:m.intercept||0,followthrough:m.followthrough||0,delivery:c.delivery}}
export function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function rectHit(x,y,r,o){return Math.hypot(x-clamp(x,o.x,o.x+o.w),y-clamp(y,o.y,o.y+o.h))<r}
export function bound(u,arena=ARENAS[0]){const r=CHASSIS[u.type].radius+3;u.x=clamp(u.x,20+r,700-r);u.y=clamp(u.y,20+r,500-r);for(const o of arena.obstacles){if(!rectHit(u.x,u.y,r+2,o))continue;const cx=clamp(u.x,o.x,o.x+o.w),cy=clamp(u.y,o.y,o.y+o.h);let dx=u.x-cx,dy=u.y-cy,d=Math.hypot(dx,dy);if(d<.0001){const sides=[{v:Math.abs(u.x-o.x),x:o.x-r,y:u.y},{v:Math.abs(u.x-(o.x+o.w)),x:o.x+o.w+r,y:u.y},{v:Math.abs(u.y-o.y),x:u.x,y:o.y-r},{v:Math.abs(u.y-(o.y+o.h)),x:u.x,y:o.y+o.h+r}].sort((a,b)=>a.v-b.v);u.x=sides[0].x;u.y=sides[0].y}else{u.x=cx+dx/d*r;u.y=cy+dy/d*r}u.x=clamp(u.x,20+r,700-r);u.y=clamp(u.y,20+r,500-r)}}
function segmentRect(a,b,o,pad=0){const dx=b.x-a.x,dy=b.y-a.y;let lo=0,hi=1;for(const [p,q] of [[-dx,a.x-(o.x-pad)],[dx,o.x+o.w+pad-a.x],[-dy,a.y-(o.y-pad)],[dy,o.y+o.h+pad-a.y]]){if(Math.abs(p)<1e-9){if(q<0)return false;continue}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false}return true}
export function clearLine(a,b,arena=ARENAS[0],pad=0){return !arena.obstacles.some(o=>segmentRect(a,b,o,pad))}
// Exact physical clearance is used only to connect a chassis already hugging
// a corner to the stable terrain graph. Ordinary graph edges remain conservative.
function physicalLineClear(a,b,arena,r){
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
function navigationPath(start,end,arena,r,viaPenalty=0){
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
function actorClearance(state,u,point,seconds=0){
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
function healthFraction(u){return clamp(u.hp/u.maxHp,0,1)}
export function targetScoreDetails(state,u,e){
 const w=u.chassis.weights,allies=state.units.filter(a=>a.hp>0&&a.owner===u.owner&&a.id!==u.id),st=stats(u);
 const d=distance(u,e),ratio=healthFraction(e),enemyStats=stats(e),enemyAllies=state.units.filter(a=>a.hp>0&&a.owner===e.owner&&a.id!==e.id);
 const isolated=enemyAllies.length?Math.min(...enemyAllies.map(a=>distance(a,e)))/200:1,nearAllies=allies.length?Math.min(...allies.map(a=>distance(a,e))):250;
 const features={kill:1-ratio,damage:st.damage/Math.max(1,e.hp),threat:enemyStats.damage/30+(e.focus===u.id?.5:0),distance:1-d/500,allyProximity:1-nearAllies/500,safety:d/500,protection:allies.some(a=>e.focus===a.id)?1:0,ability:u.cd<=0?1:0,isolation:clamp(isolated,0,1),preferredRange:1-Math.abs(d-st.range)/500};
 const contributions=Object.fromEntries(METRICS.map(k=>[k,(w[k]||0)*features[k]]));
 const total=METRICS.reduce((sum,k)=>sum+contributions[k],0)+(u.focus===e.id?.2:0);
 return {total,features,contributions};
}
export function chooseTarget(state,u,enemies){
 if(u.tauntedUntil>state.time){const forced=enemies.find(e=>e.id===u.tauntedBy);if(forced)return forced}
 let best=null,score=-Infinity;
 for(const e of enemies){const value=targetScoreDetails(state,u,e).total;if(value>score){score=value;best=e}}
 const current=enemies.find(e=>e.id===u.focus);
 // Routing to a target is a commitment. Small score changes should not flip
 // destinations every tick, especially while turning around solid obstacles.
 if(current&&current!==best){
  const currentScore=targetScoreDetails(state,u,current).total;
  const hysteresis=u.navigation?.path?.length?.6:.24;
  if(score-currentScore<hysteresis)return current;
 }
 return best;
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
export function resolveCollision(state){const units=state.units.filter(u=>u.hp>0);for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){const a=units[i],b=units[j];if((a.phasingUntil>state.time&&a.phaseTarget===b.id)||(b.phasingUntil>state.time&&b.phaseTarget===a.id))continue;const min=CHASSIS[a.type].radius+CHASSIS[b.type].radius+5;let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=min)continue;if(d<.001){dx=a.id<b.id?1:-1;dy=0;d=1}const delta=(min-d)/2;a.x-=dx/d*delta;a.y-=dy/d*delta;b.x+=dx/d*delta;b.y+=dy/d*delta;bound(a,state.arena);bound(b,state.arena)}}
export function teamPercent(state,owner){const team=state.units.filter(u=>u.owner===owner);const max=team.reduce((n,u)=>n+u.maxHp,0);return max?team.reduce((n,u)=>n+Math.max(0,u.hp),0)/max:0}
// Randomize the *owner-to-corner assignment*, not just the arena orientation.
// When a prior assignment is supplied, no player repeats their previous corner.
export function spawnSlots(seed,previousSlots=null){
 const random=rng(seed),permutations=[];
 for(let a=0;a<4;a++)for(let b=0;b<4;b++)if(b!==a)for(let c=0;c<4;c++)if(c!==a&&c!==b)for(let d=0;d<4;d++)if(d!==a&&d!==b&&d!==c)permutations.push([a,b,c,d]);
 const eligible=previousSlots?.length===4?permutations.filter(p=>p.every((slot,i)=>slot!==previousSlots[i])):permutations;
 return eligible[Math.floor(random()*eligible.length)].slice()
}
export function spawn(players,arena=ARENAS[0],seed=1,round=1,previousSlots=null){const starts=[[110,100],[610,100],[610,420],[110,420]],random=rng(seed),slots=spawnSlots(seed+round*37,previousSlots);return {phase:'fight',time:0,tick:0,events:[],visualEvents:[],arena,spawnSlots:slots.slice(),units:players.flatMap((p,i)=>p.hp<=0?[]:p.squad.map((chassis,j)=>{const type=chassis.type,base=starts[slots[i%4]],u={id:i*100+j,owner:i,type,chassis,x:base[0]+(j%3-1)*33,y:base[1]+(Math.floor(j/3)-1)*30,cd:random()*.25,focus:null,tauntedBy:null,tauntedUntil:0,mobilityCd:{},evadingUntil:0,phasingUntil:0,hp:1,maxHp:1,attacker:null};const st=stats(u);u.hp=u.maxHp=st.hp;bound(u,arena);return u})),players,eliminations:[],damageDealt:players.map(()=>0),random}}
// Each firing cycle fans out into independent lanes. A lane can pierce deeper,
// but an enemy can only be hit once across all lanes in that cycle.
function targetsForAttack(state,u,target,st){
 const enemies=state.units.filter(e=>e.hp>0&&e.owner!==u.owner);
 const angle=Math.atan2(target.y-u.y,target.x-u.x);
 const count=Math.min(1+Math.max(0,st.projectiles-1),9);
 const spacing=.22; // 12.6 degrees between lanes
 const lanes=Array.from({length:count},(_,i)=>angle+(i===0?0:(i%2?1:-1)*Math.ceil(i/2)*spacing));
 const hits=[],hitIds=new Set();
 for(const lane of lanes){
  const dx=Math.cos(lane),dy=Math.sin(lane);
  const candidates=enemies.map(e=>{
   const vx=e.x-u.x,vy=e.y-u.y;
   return {enemy:e,along:vx*dx+vy*dy,across:Math.abs(vx*dy-vy*dx)};
  }).filter(({enemy,along,across})=>along>0&&along<=st.range+st.area*15+CHASSIS[enemy.type].radius&&across<=CHASSIS[enemy.type].radius+5+st.area*8&&clearLine(u,enemy,state.arena))
   .sort((a,b)=>a.along-b.along||a.enemy.id-b.enemy.id);
  // A lane stops after the first enemy unless Piercing adds depth.
  for(const {enemy} of candidates.slice(0,1+st.piercing)){
   if(hitIds.has(enemy.id))continue;
   hitIds.add(enemy.id);hits.push(enemy);
  }
 }
 return {hits,lanes};
}

// Utility movement is deterministic, shares the existing targeting weights, and
// consumes its own cooldown. Terrain still blocks every movement technique.
// Shared movement policy: the same ten editable weights score every position.
// Chassis differ through stats and initial weights, never privileged AI branches.
export function positionScore(state,u,target,point,st,enemies){
 const w=u.chassis.weights,allies=state.units.filter(a=>a.hp>0&&a.owner===u.owner&&a!==u);
 const d=distance(point,target),old=distance(u,target),visible=clearLine(point,target,state.arena);
 // Anticipate where enemies are headed, rather than only where they stand.
 // Intent is captured before any unit moves this tick, so evaluation is order-independent.
 const forecast=enemies.map(e=>{
  const es=stats(e),intent=e.intent||{x:0,y:0};
  const future={x:e.x+intent.x*es.speed*.45,y:e.y+intent.y*es.speed*.45};
  const now=distance(point,e),soon=distance(point,future);
  const exposure=Math.max(0,1-Math.min(now,soon)/Math.max(1,es.range+es.radius+35));
  const approaching=soon<now-3;
  const aimed=e.focus===u.id?1.25:1;
  return {e,es,now,soon,exposure,approaching,aimed};
 });
 const nearest=forecast.reduce((best,f)=>Math.min(best,f.now,f.soon),Infinity);
 const threat=forecast.reduce((sum,f)=>sum+f.exposure*f.es.damage/25*f.aimed,0);
 const approachingThreat=forecast.reduce((sum,f)=>sum+(f.approaching?Math.max(0,1-f.soon/Math.max(90,f.es.range+80))*.65:0)*f.es.damage/25,0);
 const threatenedAllies=allies.filter(a=>enemies.some(e=>e.focus===a.id||distance(e,a)<65));
 const allyDistance=allies.length?Math.min(...allies.map(a=>distance(point,a))):120;
 const protectionDistance=threatenedAllies.length?Math.min(...threatenedAllies.map(a=>distance(point,a))):120;
 const isolated=enemies.filter(e=>e!==target).every(e=>distance(point,e)>90);
 const ideal=st.range*.85;
 const rangeFit=1-Math.min(1,Math.abs(d-ideal)/Math.max(35,st.range*.55));
 const attack=visible&&d<=st.range?1:0;
 const features={
  kill:(1-healthFraction(target))*(attack?.9:.3),
  damage:attack?1:.12,
  threat:-(threat+approachingThreat)*.5, // incoming and imminent exposure
  distance:1-Math.min(1,d/300),
  allyProximity:1-Math.min(1,allyDistance/180),
  safety:Math.min(1,nearest/Math.max(145,st.range*.95))-(threat+approachingThreat)*.55,
  protection:threatenedAllies.length?1-Math.min(1,protectionDistance/180):0,
  ability:(u.cd<=0&&attack?1:0)+(st.dash&&d>st.range&&d<st.range+100?.2:0),
  isolation:isolated?.6:0,
  preferredRange:rangeFit
 };
 let score=METRICS.reduce((sum,k)=>sum+(w[k]||0)*features[k],0);
 // More safety-conscious allies yield space to teammates who prefer taking risks.
 // The preference is relative: a bold ranged build may stand its ground.
 const mySafety=w.safety||0;
 for(const ally of allies){
  const theirSafety=ally.chassis.weights.safety||0;
  const yielding=Math.max(0,mySafety-theirSafety);
  if(!yielding)continue;
  const separation=distance(point,ally),now=distance(u,ally);
  const buffer=st.radius+stats(ally).radius+26;
  const allyIntent=ally.intent||{x:0,y:0};
  const nextAlly={x:ally.x+allyIntent.x*stats(ally).speed*.35,y:ally.y+allyIntent.y*stats(ally).speed*.35};
  const predicted=distance(point,nextAlly);
  score-=yielding*.85*Math.max(0,1-Math.min(separation,predicted)/buffer);
  if(now<buffer+18&&separation<now)score-=yielding*.22*(now-separation)/Math.max(1,st.speed*STEP);
 }
 // Small inertial preference avoids jitter and keeps neutral weights functional.
 score+=.08*(d<old?1:0)-.03*distance(u,point)/Math.max(1,st.speed);
 return score;
}
export function chooseMovement(state,u,target,st,enemies,dt){
 const arena=state.arena,step=st.speed*dt,r=CHASSIS[u.type].radius+3;
 const terrainBlocked=!clearLine(u,target,arena,0);
 const routeBlocked=terrainBlocked||(distance(u,target)>st.range&&!clearLine(u,target,arena,r));
 const actorPressure=actorClearance(state,u,u,dt);
 u.navigationBlocked=routeBlocked;u.navigationActorPressure=actorPressure;
 let nav=u.navigation;
 const hasGoal=routeBlocked||distance(u,target)>Math.min(st.range*.85,st.range-5);
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
 const activeApproach=distance(u,target)>st.range||terrainBlocked;
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
 let best={x:0,y:0,score:-Infinity};
 for(const dir of candidates){
  if((dir.x||dir.y)&&!valid(dir))continue;
  const p={x:u.x+dir.x*step,y:u.y+dir.y*step};
  const pressure=actorClearance(state,u,p,dt*.8);
  const progress=distance(u,target)-distance(p,target);
  const score=positionScore(state,u,target,p,st,enemies)-pressure*.09
   +(hasGoal?progress*.09:0);
  if(score>best.score+1e-8)best={...dir,score};
 }
 return best;
}
function utilityMove(state,u,target,st,dt,enemies){
 const cds=u.mobilityCd||(u.mobilityCd={}),now=state.time,burst=st.speed*.4;
 const ready=key=>(cds[key]||0)<=now;
 const base=positionScore(state,u,target,u,st,enemies);
 const d=distance(u,target),dx=(target.x-u.x)/Math.max(1,d),dy=(target.y-u.y)/Math.max(1,d);
 const proposals=[];
 const offer=(key,point,dist,cooldown,options={})=>{
  if(!st[key]||!ready(key))return;
  const length=distance(u,point);
  if(length<1)return;
  const step=Math.min(dist,length);
  const p={x:u.x+(point.x-u.x)/length*step,y:u.y+(point.y-u.y)/length*step};
  if(!clearLine(u,p,state.arena,CHASSIS[u.type].radius+3))return;
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
 if(intercept)offer('intercept',intercept.enemy,burst*(.8+.2*st.intercept),5);
 if(threatened)offer('dodge',{x:u.x-dy*100,y:u.y+dx*100},burst*(.65+.2*st.dodge),5,{evade:.12+st.dodge*.04});
 if(enemies.filter(e=>distance(u,e)<75).length>=2)offer('disengage',{x:u.x-dx*110,y:u.y-dy*110},burst*(.75+.2*st.disengage),6);
 if(d<Math.max(85,st.range*.8))offer('backstep',{x:u.x-dx*110,y:u.y-dy*110},burst*(.75+.2*st.backstep),4.5);
 if(d<st.range+25&&d>10)offer('followthrough',{x:target.x+dx*(CHASSIS[u.type].radius+CHASSIS[target.type].radius+22),y:target.y+dy*(CHASSIS[u.type].radius+CHASSIS[target.type].radius+22)},burst*(.8+.3*st.followthrough),6,{phase:true});
 if(d>st.range+35&&d<st.range+190)offer('dash',{x:target.x-dx*Math.max(10,st.range*.7),y:target.y-dy*Math.max(10,st.range*.7)},burst*(1+.35*st.dash),5);
 if(d>st.range*.7&&d<st.range+100)for(const side of [-1,1])offer('flank',{x:target.x-dx*st.range-side*dy*(35+st.flank*12),y:target.y-dy*st.range+side*dx*(35+st.flank*12)},burst*(.65+.2*st.flank),4);
 // Abilities are optional tools. Their projected position must beat staying
 // and ordinary walking; high Safety/Protection/etc. determines their use.
 const normal=u.moveDecision||{x:0,y:0};
 const walk={x:u.x+normal.x*st.speed*dt,y:u.y+normal.y*st.speed*dt};
 const threshold=Math.max(base,positionScore(state,u,target,walk,st,enemies))+.015;
 const best=proposals.sort((a,b)=>b.score-a.score)[0];
 if(!best||best.score<=threshold)return false;
 const ox=u.x,oy=u.y;u.x=best.p.x;u.y=best.p.y;bound(u,state.arena);
 cds[best.key]=now+best.cooldown;
 if(best.options.evade)u.evadingUntil=now+best.options.evade;
 if(best.options.phase){u.phasingUntil=now+dt+.01;u.phaseTarget=target.id}
 state.visualEvents.push({kind:'mobility',x:ox,y:oy,toX:u.x,toY:u.y,owner:u.owner,ability:best.key});
 return true;
}
export function tick(state,dt=STEP){if(state.phase!=='fight')return null;state.time+=dt;state.tick++;state.visualEvents=[];
 // Snapshot intentions for all units before sequential movement begins.
 for(const unit of state.units){
  if(unit.hp<=0)continue;
  const opponents=state.units.filter(e=>e.hp>0&&e.owner!==unit.owner);
  const target=opponents.length?chooseTarget(state,unit,opponents):null;
  unit.focus=target?.id??null;
  const prior=unit.moveDecision||{x:0,y:0};
  const norm=Math.hypot(prior.x,prior.y);
  unit.intent=norm>1e-8?{x:prior.x/norm,y:prior.y/norm}:target?{x:(target.x-unit.x)/Math.max(1,distance(unit,target)),y:(target.y-unit.y)/Math.max(1,distance(unit,target))}:{x:0,y:0};
 }
const attacks=[],wasAlive=new Set(state.units.filter(u=>u.hp>0).map(u=>u.owner));for(const u of state.units){if(u.hp<=0)continue;const st=stats(u);if(u.chassis.passives.includes('regen'))u.hp=Math.min(u.maxHp,u.hp+2*dt);u.cd-=dt;const enemies=state.units.filter(e=>e.hp>0&&e.owner!==u.owner);if(!enemies.length)continue;const t=chooseTarget(state,u,enemies);if(!t)continue;u.focus=t.id;utilityMove(state,u,t,st,dt,enemies);const d=distance(u,t),visible=clearLine(u,t,state.arena),inRange=d<=st.range&&visible;const direction=chooseMovement(state,u,t,st,enemies,dt);
 u.moveDecision=direction;u.moveTarget=t.id;
 if(state.diagnostics){const d=state.diagnostics;const record=d.units[u.id]||(d.units[u.id]={owner:u.owner,type:u.type,frames:0,idle:0,blocked:0,replans:0,stuck:0,waypointChanges:0,collisionLoss:0,intended:0,actual:0,attackOpportunities:0,shots:0,damage:0,routeProgress:0,reversals:0,reasonCounts:{},samples:[]});
 record.frames++;if(!direction.x&&!direction.y)record.idle++;if(u.navigationBlocked)record.blocked++;
 const route=u.navigation,waypoint=route?.path?.[0];const key=waypoint?Math.round(waypoint.x)+','+Math.round(waypoint.y):'none';
 if(record.lastWaypoint!==undefined&&record.lastWaypoint!==key)record.waypointChanges++;record.lastWaypoint=key;
 if(record.lastRoute&&route!==record.lastRoute){record.replans++;const reason=record.lastTarget!==t.id?'target-changed':u.navRecoverUntil>state.time?'stuck-recovery':'route-invalid-or-destination';record.reasonCounts[reason]=(record.reasonCounts[reason]||0)+1}record.lastRoute=route;record.lastTarget=t.id;
 if((u.navStuckCount||0)>record.stuck){record.stuck=u.navStuckCount;record.reasonCounts.stuck=(record.reasonCounts.stuck||0)+1}
 if(record.lastDirection&&direction.x*record.lastDirection.x+direction.y*record.lastDirection.y<-.5)record.reversals++;record.lastDirection={x:direction.x,y:direction.y};
 if(inRange)record.attackOpportunities++;
 record.before={x:u.x,y:u.y,step:st.speed*dt,waypointDistance:waypoint?distance(u,waypoint):null};
 }
 if(direction.x||direction.y){const step=st.speed*dt;u.move={x:direction.x,y:direction.y};u.x+=direction.x*step;u.y+=direction.y*step;bound(u,state.arena)}
 if(inRange&&u.cd<=0){if(state.diagnostics)state.diagnostics.units[u.id].shots++;const volley=targetsForAttack(state,u,t,st);if(st.delivery==='projectile')for(const angle of volley.lanes)state.visualEvents.push({kind:'projectile',x:u.x,y:u.y,toX:u.x+Math.cos(angle)*st.range,toY:u.y+Math.sin(angle)*st.range,owner:u.owner});for(const victim of volley.hits){attacks.push({source:u,target:victim,damage:Math.max(1,st.damage-stats(victim).defense),knockback:st.knockback,taunt:st.taunt});}u.cd+=st.rate}}
 resolveCollision(state);
 if(state.diagnostics){for(const u of state.units){const record=state.diagnostics.units[u.id];if(!record?.before)continue;const before=record.before,actual=distance(before,u);record.actual+=actual;record.intended+=before.step*(record.lastDirection.x||record.lastDirection.y?1:0);if(before.step>0&&actual<before.step*.2&&(record.lastDirection.x||record.lastDirection.y))record.collisionLoss++;if(before.waypointDistance!==null&&u.navigation?.path?.[0])record.routeProgress+=before.waypointDistance-distance(u,u.navigation.path[0]);delete record.before;
 if(state.tick%30===0&&record.samples.length<35)record.samples.push({t:Math.round(state.time),x:Math.round(u.x),y:Math.round(u.y),idle:record.idle,blocked:record.blocked,stuck:record.stuck});}}
 const totals=new Map();for(const a of attacks)if(!(a.target.evadingUntil>state.time)){const dealt=Math.min(a.damage,Math.max(0,a.target.hp));state.damageDealt[a.source.owner]+=dealt;if(state.diagnostics&&state.diagnostics.units[a.source.id])state.diagnostics.units[a.source.id].damage+=dealt;totals.set(a.target,(totals.get(a.target)||0)+a.damage)}for(const [target,damage] of totals){const applied=Math.min(target.hp,damage);target.hp=Math.max(0,target.hp-damage);if(applied>0)state.visualEvents.push({kind:'damage',x:target.x,y:target.y,value:applied,owner:target.owner})}// Taunt begins on a landed attack. Repeated hits refresh the duration; stacks increase it.
 // Multiple simultaneous taunts resolve deterministically in attack processing order.
 for(const a of attacks){if(a.taunt>0&&a.source.hp>0&&a.target.hp>0){a.target.tauntedBy=a.source.id;a.target.tauntedUntil=state.time+.25*a.taunt}}
 for(const a of attacks){if(a.knockback&&a.target.hp>0){const d=Math.max(1,distance(a.source,a.target));a.target.x+=(a.target.x-a.source.x)/d*a.knockback*4;a.target.y+=(a.target.y-a.source.y)/d*a.knockback*4;bound(a.target,state.arena)}}
 for(const u of state.units)if(u.hp===0&&!u.reported){u.reported=true;state.events.push(state.players[u.owner].name+' '+CHASSIS[u.type].name+' defeated');}
 const nowAlive=new Set(state.units.filter(u=>u.hp>0).map(u=>u.owner));for(const owner of wasAlive)if(!nowAlive.has(owner)){state.eliminations.push({owner,tick:state.tick});state.events.push(state.players[owner].name+' team eliminated')}
 if(nowAlive.size<=1||state.time>=DURATION)return [...nowAlive];return null}
export function placementGroups(state){const active=state.players.map((p,i)=>p.hp>0?i:-1).filter(i=>i>=0);const alive=active.filter(i=>state.units.some(u=>u.owner===i&&u.hp>0));const dead=active.filter(i=>!alive.includes(i));const groups=[];const survivors=[...alive].sort((a,b)=>teamPercent(state,b)-teamPercent(state,a));for(const i of survivors){const score=teamPercent(state,i),last=groups.at(-1);if(last&&last[0].survivor&&Math.abs(last[0].score-score)<1e-9)last.push({owner:i,score,survivor:true});else groups.push([{owner:i,score,survivor:true}])}
 const deathTicks=new Map(state.eliminations.map(e=>[e.owner,e.tick]));dead.sort((a,b)=>(deathTicks.get(b)||0)-(deathTicks.get(a)||0));for(const i of dead){const score=deathTicks.get(i)||0,last=groups.at(-1);if(last&&!last[0].survivor&&last[0].score===score)last.push({owner:i,score,survivor:false});else groups.push([{owner:i,score,survivor:false}])}return groups.map(g=>g.map(x=>x.owner))}
export function placementDamage(round,place,activeCount,streak){if(place===1)return 0;const base=3+(place-2)*3;return Math.round(base*(1+Math.max(0,round-1)*.35)*(1+Math.max(0,streak)*.15))}
export function resolvePlayerHP(players,ranking,round){const bottom=Math.floor(ranking.length/2);for(let place=1;place<=ranking.length;place++){const p=players[ranking[place-1]];const losing=place>ranking.length-bottom;p.streak=losing?(p.streak||0)+1:0;p.hp=Math.max(0,p.hp-placementDamage(round,place,ranking.length,losing?p.streak-1:0))}return players}
