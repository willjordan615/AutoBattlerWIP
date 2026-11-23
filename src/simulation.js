// Deterministic, renderer-independent combat backend. Values are provisional balance defaults.
export const CHASSIS={
 bruiser:{name:'Bruiser',hp:155,damage:16,range:58,speed:48,rate:1.25,defense:4,radius:15,delivery:'melee',fill:'#eeb878',desc:'Durable melee frontliner'},
 rogue:{name:'Rogue',hp:105,damage:18,range:60,speed:95.45,rate:.78,defense:1,radius:11,delivery:'melee',fill:'#c2a1fa',desc:'Fast opportunistic melee'},
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
export const ATTACK_TIMING={bruiser:{windup:.30,recovery:.22,lock:.5,windupMove:.18,recoveryMove:.55,arc:95},rogue:{windup:.18,recovery:.12,lock:.5,windupMove:.3,recoveryMove:.75,arc:35},ranged:{windup:.24,recovery:.18,lock:.5,windupMove:.22,recoveryMove:.55,arc:0}};
export function rng(seed=12345){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
export function makeChassis(type){if(!CHASSIS[type])throw Error('Unknown chassis');return {type,mods:{hp:0,damage:0,speed:0,rate:0,range:0,projectiles:0,piercing:0,area:0,knockback:0,taunt:0,dash:0,dodge:0,backstep:0,flank:0,disengage:0,intercept:0,followthrough:0,range:0,sunder:0,precision:0,expose:0,disruption:0,momentum:0,chain:0,burning:0,hazardous:0,restless:0},weights:Object.fromEntries(METRICS.map((m,i)=>[m,BASE_WEIGHTS[type][i]])),passives:[],modules:[]}}
export function stats(u){const c=CHASSIS[u.type],m=u.chassis.mods;return {hp:c.hp+m.hp*20,damage:c.damage+m.damage*2,speed:(c.speed+m.speed*18)*(u.hasteUntil>u.stateTime?1.4:1)*(u.effects?.slowUntil>u.stateTime?1-Math.min(.45,u.effects.slowStrength||0):1),range:c.range+m.range*8,rate:c.rate/(1+m.rate*.15)/(u.focusUntil>u.stateTime?1.35:1),defense:c.defense+(u.bulwarkUntil>u.stateTime?5:0),radius:c.radius,projectiles:1+m.projectiles,piercing:m.piercing,area:m.area,knockback:m.knockback,taunt:m.taunt||0,dash:m.dash||0,dodge:m.dodge||0,backstep:m.backstep||0,flank:m.flank||0,disengage:m.disengage||0,intercept:m.intercept||0,followthrough:m.followthrough||0,delivery:c.delivery}}
export function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function rectHit(x,y,r,o){return Math.hypot(x-clamp(x,o.x,o.x+o.w),y-clamp(y,o.y,o.y+o.h))<r}
export function bound(u,arena=ARENAS[0]){const r=CHASSIS[u.type].radius+3;u.x=clamp(u.x,20+r,700-r);u.y=clamp(u.y,20+r,500-r);for(const o of arena.obstacles){if(!rectHit(u.x,u.y,r,o))continue;const cx=clamp(u.x,o.x,o.x+o.w),cy=clamp(u.y,o.y,o.y+o.h);let dx=u.x-cx,dy=u.y-cy,d=Math.hypot(dx,dy);if(d<.0001){const sides=[{v:Math.abs(u.x-o.x),x:o.x-r,y:u.y},{v:Math.abs(u.x-(o.x+o.w)),x:o.x+o.w+r,y:u.y},{v:Math.abs(u.y-o.y),x:u.x,y:o.y-r},{v:Math.abs(u.y-(o.y+o.h)),x:u.x,y:o.y+o.h+r}].sort((a,b)=>a.v-b.v);u.x=sides[0].x;u.y=sides[0].y}else{u.x=cx+dx/d*(r+.01);u.y=cy+dy/d*(r+.01)}u.x=clamp(u.x,20+r,700-r);u.y=clamp(u.y,20+r,500-r)}}
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
 const restlessness=u.chassis.mods.restless||0;
 const recent=u.lastAttacked===e.id?Math.max(0,1-(state.time-u.lastAttackAt)/3):0;
 const total=METRICS.reduce((sum,k)=>sum+contributions[k],0)+(u.focus===e.id?.2:0)-Math.min(2.4,.9*restlessness)*recent;
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
export function spawn(players,arena=ARENAS[0],seed=1,round=1,previousSlots=null){const starts=[[110,100],[610,100],[610,420],[110,420]],random=rng(seed),slots=spawnSlots(seed+round*37,previousSlots);return {phase:'fight',time:0,tick:0,events:[],visualEvents:[],arena,spawnSlots:slots.slice(),units:players.flatMap((p,i)=>p.hp<=0?[]:p.squad.map((chassis,j)=>{const type=chassis.type,base=starts[slots[i%4]],u={id:i*100+j,owner:i,type,chassis,x:base[0]+(j%3-1)*33,y:base[1]+(Math.floor(j/3)-1)*30,cd:random()*.25,motion:[],effects:{},lastAttacked:null,lastAttackAt:-100,retaliationReady:0,focus:null,tauntedBy:null,tauntedUntil:0,facing:0,attack:null,mobilityCd:{},reactionCd:{},stateTime:0,hasteUntil:0,focusUntil:0,bulwarkUntil:0,combatStats:{damage:0,damageTaken:0,attacks:0,shots:0,hits:0,wallHits:0,interceptions:0,dodges:0,evaded:0,prevented:0,haste:0,focus:0,bulwark:0},evadingUntil:0,phasingUntil:0,hp:1,maxHp:1,attacker:null};const st=stats(u);u.hp=u.maxHp=st.hp;bound(u,arena);return u})),players,eliminations:[],damageDealt:players.map(()=>0),zones:[],projectiles:[],nextProjectileId:1,random}}
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
  const d=distance(u,enemy),reach=st.range+st.area*9+CHASSIS[enemy.type].radius;
  if(d>reach||d<1e-7)continue;
  const bearing=Math.atan2(enemy.y-u.y,enemy.x-u.x);
  const within=lanes.some(lane=>Math.abs(Math.atan2(Math.sin(bearing-lane),Math.cos(bearing-lane)))<=
   wide/2+Math.asin(Math.min(.98,CHASSIS[enemy.type].radius/Math.max(1,d))));
  if(within)candidates.push({enemy,d});
 }
 candidates.sort((a,b)=>a.d-b.d||a.enemy.id-b.enemy.id);
 return candidates.slice(0,1+Math.max(0,st.piercing)).map(c=>c.enemy);
}
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
 const profile=ATTACK_TIMING[u.type];
 attack.elapsed+=dt;
 if(attack.phase==='windup'){
  if(!attack.locked){
   if(target?.hp>0)attack.direction=Math.atan2(target.y-u.y,target.x-u.x);
   u.facing=attack.direction;
   if(attack.elapsed>=profile.windup*profile.lock){
    attack.locked=true;
    state.visualEvents.push({kind:'attackCommit',x:u.x,y:u.y,owner:u.owner,
     type:u.type,angle:attack.direction,reach:st.range,arc:profile.arc});
   }
  }
  if(attack.elapsed+1e-8<profile.windup)return;
  attack.phase='recovery';attack.elapsed=0;
  u.combatStats&&(u.combatStats.attacks++);
  // Only enemies inside the locked attack shape at release can be hit.
  if(st.delivery==='projectile'){
   const dx=Math.cos(attack.direction),dy=Math.sin(attack.direction);
   spawnProjectileVolley(state,u,{id:attack.targetId,x:u.x+dx*st.range,y:u.y+dy*st.range},st,attack.direction);
  }else{
   for(const victim of meleeAttackTargets(state,u,attack.direction,st)){
    attacks.push({source:u,target:victim,rawDamage:st.damage,
     damage:Math.max(1,st.damage-stats(victim).defense),
     knockback:st.knockback,taunt:st.taunt});
   }
  }
  u.cd+=st.rate;
  return;
 }
 if(attack.phase==='recovery'&&attack.elapsed+1e-8>=profile.recovery)u.attack=null;
}
export function attackMovementMultiplier(u){
 if(!u.attack)return 1;
 const profile=ATTACK_TIMING[u.type];
 return u.attack.phase==='windup'?profile.windupMove:profile.recoveryMove;
}

// World-space projectile simulation. Every projectile is resolved in the
// deterministic combat tick; rendering reads state.projectiles without inferring hits.
export const PROJECTILE_SPEED=320;
export const PROJECTILE_RADIUS=3;
function segmentCircleHit(a,b,center,radius){
 const dx=b.x-a.x,dy=b.y-a.y,fx=a.x-center.x,fy=a.y-center.y;
 const aa=dx*dx+dy*dy,cc=fx*fx+fy*fy-radius*radius;
 if(cc<=0)return 0;
 if(aa<1e-12)return null;
 const bb=2*(fx*dx+fy*dy),disc=bb*bb-4*aa*cc;
 if(disc<0)return null;
 const t=(-bb-Math.sqrt(disc))/(2*aa);
 return t>=0&&t<=1?t:null;
}
function segmentBoxHit(a,b,o,pad=0){
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
function spawnProjectileVolley(state,u,t,st,aimAngle=null){
 const count=Math.min(st.projectiles,9),spacing=.22;
 const angle=aimAngle??Math.atan2(t.y-u.y,t.x-u.x);
 const volley={hitIds:new Set()};
 state.projectiles ||= [];
 for(let i=0;i<count;i++){
  const offset=i===0?0:(i%2?1:-1)*Math.ceil(i/2)*spacing;
  const heading=angle+offset;
  u.combatStats&&(u.combatStats.shots++);
  state.projectiles.push({
   id:state.nextProjectileId++,owner:u.owner,source:u,aimedAtId:t.id,
   x:u.x,y:u.y,vx:Math.cos(heading),vy:Math.sin(heading),
   speed:PROJECTILE_SPEED,remaining:st.range,radius:PROJECTILE_RADIUS+Math.max(0,st.area)*3,damage:st.damage,
   knockback:st.knockback,taunt:st.taunt,penetration:Math.max(0,st.piercing),
   hitIds:new Set(),volley
  });
 }
}
// Advance across the entire swept segment. Walls/arena bounds and hostile units
// compete by earliest time of impact; each target can be hit once per volley.
export function advanceProjectiles(state,dt,attacks=[]){
 if(!state.projectiles?.length||dt<=0)return attacks;
 const remaining=[];
 for(const shot of state.projectiles){
  let travel=Math.min(shot.speed*dt,shot.remaining);
  let active=true,iterations=0;
  while(active&&travel>1e-7&&iterations++<state.units.length+state.arena.obstacles.length+3){
   const from={x:shot.x,y:shot.y};
   const to={x:from.x+shot.vx*travel,y:from.y+shot.vy*travel};
   let collision=null;
   const consider=(time,kind,unit=null)=>{
    if(time===null||time<0||time>1)return;
    if(!collision||time<collision.time-1e-8||
      (Math.abs(time-collision.time)<=1e-8&&kind==='wall')){
     collision={time,kind,unit};
    }
   };
   for(const o of state.arena.obstacles)consider(segmentBoxHit(from,to,o,shot.radius),'wall');
   // The enclosed arena's playable boundary also absorbs outgoing shots.
   const limits=[{x:20,y:0,w:0,h:520},{x:700,y:0,w:0,h:520},
                 {x:0,y:20,w:720,h:0},{x:0,y:500,w:720,h:0}];
   for(const o of limits)consider(segmentBoxHit(from,to,o,0),'wall');
   for(const enemy of state.units){
    if(enemy.hp<=0||enemy.owner===shot.owner||shot.hitIds.has(enemy.id))continue;
    consider(segmentCircleHit(from,to,enemy,CHASSIS[enemy.type].radius+shot.radius),'unit',enemy);
   }
   const fraction=collision?collision.time:1;
   const moved=travel*fraction;
   shot.x=from.x+shot.vx*moved;shot.y=from.y+shot.vy*moved;
   shot.remaining-=moved;travel-=moved;
   if(!collision){active=shot.remaining>1e-7;break}
   if(collision.kind==='wall'){
    shot.source.combatStats&&(shot.source.combatStats.wallHits++);
    state.visualEvents.push({kind:'wallImpact',x:shot.x,y:shot.y,owner:shot.owner});
    active=false;break;
   }
   const victim=collision.unit;
   shot.hitIds.add(victim.id);
   if(!shot.volley.hitIds.has(victim.id)){
    shot.volley.hitIds.add(victim.id);
    if(shot.source.combatStats&&victim.id!==shot.aimedAtId)shot.source.combatStats.interceptions++;
    attacks.push({source:shot.source,target:victim,projectile:true,
     rawDamage:shot.damage,damage:Math.max(1,shot.damage-stats(victim).defense),
     knockback:shot.knockback,taunt:shot.taunt});
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
// One small deterministic threat/opportunity assessment per fighter per tick.
// Projectile risk uses projected swept motion; melee risk uses attack readiness.
export function tacticalAssessment(state,u,target,st,enemies){
 const now=state.time,lookahead=.26,radius=CHASSIS[u.type].radius+PROJECTILE_RADIUS+2;
 const shots=[];
 for(const shot of state.projectiles||[]){
  if(shot.owner===u.owner)continue;
  const horizon=Math.min(lookahead,shot.remaining/Math.max(1,shot.speed));
  if(horizon<=0)continue;
  const end={x:shot.x+shot.vx*shot.speed*horizon,y:shot.y+shot.vy*shot.speed*horizon};
  const impact=segmentCircleHit(shot,end,u,radius+Math.max(0,(shot.radius||3)-PROJECTILE_RADIUS));
  if(impact===null)continue;
  const when=horizon*impact;
  // A blocking wall means the shot will not reach this fighter.
  const hitPoint={x:shot.x+(end.x-shot.x)*impact,y:shot.y+(end.y-shot.y)*impact};
  if(!clearLine(shot,hitPoint,state.arena,shot.radius||PROJECTILE_RADIUS))continue;
  shots.push({shot,when,damage:Math.max(1,shot.damage-st.defense)});
 }
 shots.sort((a,b)=>a.when-b.when||a.shot.id-b.shot.id);
 const melee=enemies.filter(e=>e.type!=='ranged'&&
  distance(e,u)<stats(e).range+CHASSIS[u.type].radius+8&&clearLine(e,u,state.arena)&&
  e.attack?.phase==='windup'&&e.attack.locked&&
  Math.abs(Math.atan2(Math.sin(Math.atan2(u.y-e.y,u.x-e.x)-e.attack.direction),
    Math.cos(Math.atan2(u.y-e.y,u.x-e.x)-e.attack.direction)))<
  ATTACK_TIMING[e.type].arc*Math.PI/360+.2);
 const incoming=shots.reduce((sum,x)=>sum+x.damage,0)+melee.reduce((sum,e)=>sum+Math.max(1,stats(e).damage-st.defense),0);
 const close=enemies.filter(e=>distance(e,u)<Math.max(75,stats(e).range+30));
 const d=distance(u,target),clear=clearLine(u,target,state.arena);
 const engaging=d>st.range+20&&clear,retreating=close.length>0&&
  (u.chassis.weights.safety||0)>(u.chassis.weights.distance||0)+.2;
 // A finishing burst needs attacks available soon enough to exploit its window.
 // Requiring more than one ordinary hit prevents using Focus on trivial cleanup.
 const estimatedHit=Math.max(1,st.damage-stats(target).defense);
 const attacksDuringBurst=Math.max(1,Math.floor((1.5-Math.max(0,u.cd))/
  Math.max(.2,st.rate/1.35))+1);
 const finish=clear&&d<=st.range&&u.cd<=st.rate*.85&&
  target.hp>estimatedHit&&target.hp<=estimatedHit*attacksDuringBurst;
 const endangeredAllies=state.units.filter(a=>a!==u&&a.owner===u.owner&&a.hp>0&&
  enemies.some(e=>e.focus===a.id&&distance(e,a)<=stats(e).range+35));
 return {shots,melee,incoming,close,engaging,retreating,finish,endangeredAllies,now};
}
function reactToThreat(state,u,target,st,context){
 const cds=u.reactionCd||(u.reactionCd={}),now=state.time;
 const ready=k=>(cds[k]||0)<=now;
 const activate=(key,duration,cooldown)=>{
  cds[key]=now+cooldown;u[key+'Until']=now+duration;
  if(u.combatStats)u.combatStats[key]=(u.combatStats[key]||0)+1;
  state.visualEvents.push({kind:'reaction',ability:key,x:u.x,y:u.y,owner:u.owner});
 };
 // Emergency defense has priority. Dodge is displacement away from the actual
 // incoming projectile direction, not a generic target-relative sidestep.
 if(u.chassis.passives.includes('dodge')&&ready('dodge')&&(context.shots.length||context.melee.length)){
  const imminent=context.shots.filter(x=>x.when<=.20);
  const threat=imminent[0]?.shot||(!context.shots.length?context.melee[0]:null);
  if(threat){
   const heading=imminent.length?{x:threat.vx,y:threat.vy}:
    {x:(u.x-threat.x)/Math.max(1,distance(u,threat)),y:(u.y-threat.y)/Math.max(1,distance(u,threat))};
   const travel=st.speed*.4*.85,r=CHASSIS[u.type].radius+3;
   const candidates=[1,-1].map(sign=>{
    const p={x:u.x-heading.y*sign*travel,y:u.y+heading.x*sign*travel};
    const valid=p.x>=20+r&&p.x<=700-r&&p.y>=20+r&&p.y<=500-r&&
     clearLine(u,p,state.arena,r)&&!state.arena.obstacles.some(o=>rectHit(p.x,p.y,r,o));
    if(!valid)return {valid:false,score:-Infinity};
    const projectileRisk=context.shots.filter(({shot})=>{
     const horizon=Math.min(.26,shot.remaining/Math.max(1,shot.speed));
     const end={x:shot.x+shot.vx*shot.speed*horizon,y:shot.y+shot.vy*shot.speed*horizon};
     return segmentCircleHit(shot,end,p,CHASSIS[u.type].radius+(shot.radius||3))!==null;
    }).length;
    const meleeRisk=context.melee.filter(e=>distance(e,p)<stats(e).range+CHASSIS[u.type].radius+2).length;
    // Prefer a genuine escape from the path; don't roll sideways into another attacker.
    return {p,valid:true,score:-projectileRisk*10-meleeRisk*3+
     (context.melee.length?Math.min(...context.melee.map(e=>distance(e,p)))*.008:0)};
   }).sort((a,b)=>b.score-a.score);
   const safest=candidates[0];
   // Even a partial lateral roll is worthwhile when its brief invulnerability
   // covers a shot arriving before the fighter can clear the whole collision radius.
   const pathImproved=imminent.length?safest?.score>=-imminent.length*10:
    safest?.score> -context.melee.length*3+.1;
   if(safest?.valid&&pathImproved){
    // Evasion sacrifices an uncommitted attack windup, never grants an instant retry.
    if(u.attack?.phase==='windup'){u.attack=null;u.cd=Math.max(u.cd,.18)}
    const old={x:u.x,y:u.y};u.x=safest.p.x;u.y=safest.p.y;bound(u,state.arena);
    // Covers the roll frame but cannot substitute for an unsafe landing point.
    u.evadingUntil=now+.13;
    cds.dodge=now+utilityCooldown(5,st.dodge);
    u.combatStats&&(u.combatStats.dodges++);
    state.visualEvents.push({kind:'mobility',ability:'dodge',owner:u.owner,x:old.x,y:old.y,toX:u.x,toY:u.y});
   }
  }
 }
 if(u.chassis.passives.includes('bulwark')&&ready('bulwark')&&
  (context.incoming>=Math.max(8,u.hp*.055)||context.close.length>=2)){
  activate('bulwark',2,6);
 }
 if(u.chassis.passives.includes('haste')&&ready('haste')&&(context.engaging||context.retreating)){
  activate('haste',1.5,5);
 }
 if(u.chassis.passives.includes('focus')&&ready('focus')&&context.finish){
  activate('focus',1.5,6);
 }
}
// Utility upgrades add a second use window, not a stronger teleport.
export function utilityCooldown(base,copies){return base/Math.min(2,Math.max(1,copies||1))}
function utilityMove(state,u,target,st,dt,enemies,context){
 const cds=u.mobilityCd||(u.mobilityCd={}),now=state.time,burst=st.speed*.4;
 // A second copy provides twice the use frequency without longer teleports.
 const ready=key=>(cds[key]||0)<=now;
 const strength=key=>Math.min(1,st[key]||0);
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
 if(intercept&&context.endangeredAllies.length)offer('intercept',intercept.enemy,burst*(.8+.2*strength('intercept')),5,{urgent:true});
 // Dodge is an emergency reaction, handled before routine utility movement.
 if(context.close.length>=2)offer('disengage',{x:u.x-dx*110,y:u.y-dy*110},burst*(.75+.2*strength('disengage')),6);
 if((context.close.length>0||context.melee.length>0)&&d<Math.max(85,st.range*.8))offer('backstep',{x:u.x-dx*110,y:u.y-dy*110},burst*(.75+.2*strength('backstep')),4.5);
 if(d<st.range+25&&d>10)offer('followthrough',{x:target.x+dx*(CHASSIS[u.type].radius+CHASSIS[target.type].radius+22),y:target.y+dy*(CHASSIS[u.type].radius+CHASSIS[target.type].radius+22)},burst*(.8+.3*strength('followthrough')),6,{phase:true});
 if(context.engaging&&d<st.range+190)offer('dash',{x:target.x-dx*Math.max(10,st.range*.7),y:target.y-dy*Math.max(10,st.range*.7)},burst*(1+.35*strength('dash')),5);
 if(d>st.range*.7&&d<st.range+100&&clearLine(u,target,state.arena))for(const side of [-1,1])offer('flank',{x:target.x-dx*st.range-side*dy*(35+strength('flank')*12),y:target.y-dy*st.range+side*dx*(35+strength('flank')*12)},burst*(.65+.2*strength('flank')),4);
 // Abilities are optional tools. Their projected position must beat staying
 // and ordinary walking; high Safety/Protection/etc. determines their use.
 const normal=u.moveDecision||{x:0,y:0};
 const walk={x:u.x+normal.x*st.speed*dt,y:u.y+normal.y*st.speed*dt};
 const threshold=Math.max(base,positionScore(state,u,target,walk,st,enemies))+.015;
 const best=proposals.sort((a,b)=>b.score-a.score)[0];
 if(!best||(!best.options.urgent&&best.score<=threshold))return false;
 const ox=u.x,oy=u.y;u.x=best.p.x;u.y=best.p.y;bound(u,state.arena);
 cds[best.key]=now+utilityCooldown(best.cooldown,st[best.key]);
 if(best.options.evade)u.evadingUntil=now+best.options.evade;
 if(best.options.phase){u.phasingUntil=now+dt+.01;u.phaseTarget=target.id}
 state.visualEvents.push({kind:'mobility',x:ox,y:oy,toX:u.x,toY:u.y,owner:u.owner,ability:best.key});
 return true;
}
// Attack effects act on actual impacts, never on visual commitment events.
function traveledRecently(u,now){
 const path=u.motion||[];let total=0;
 for(let i=1;i<path.length;i++)if(path[i].time>=now-2)total+=distance(path[i-1],path[i]);
 return Math.min(100,total);
}
export function resolveAttackModules(state,attacks){
 const output=[];
 for(const hit of attacks){
  if(hit.secondary||hit.indirect){output.push(hit);continue}
  const source=hit.source,target=hit.target,mods=source.chassis.mods;
  const effects=target.effects|| (target.effects={});
  let raw=hit.rawDamage??hit.damage;
  if(mods.precision&&target.hp/target.maxHp>.75)raw+=mods.precision*2;
  if(mods.momentum)raw+=mods.momentum*2*traveledRecently(source,state.time)/100;
  if(source.retaliationReady>state.time){raw+=4;source.retaliationReady=0}
  if(effects.expose&&effects.expose.until>state.time&&
     effects.expose.owner===source.owner&&effects.expose.sourceId!==source.id){
   raw+=2*effects.expose.stacks;effects.expose=null;
  }
  const defense=Math.max(0,stats(target).defense-
   (effects.sunderUntil>state.time?Math.min(3,effects.sunder||0):0));
  hit.rawDamage=raw;hit.damage=Math.max(1,raw-defense);
  const chained=mods.chain?state.units.filter(u=>u!==target&&u.hp>0&&u.owner!==source.owner&&
   distance(u,target)<=95&&clearLine(target,u,state.arena)).sort((a,b)=>distance(a,target)-distance(b,target)||a.id-b.id)[0]:null;
  const split=mods.chain?Math.min(.6,.2*mods.chain):0;
  hit.damage*=1-split;
  output.push(hit);
  if(chained){
   output.push({source,target:chained,rawDamage:raw*split,
    damage:Math.max(0,raw*split-stats(chained).defense),secondary:true});
   state.visualEvents.push({kind:'chain',x:target.x,y:target.y,toX:chained.x,toY:chained.y,owner:source.owner});
  }
  if(mods.sunder){effects.sunder=Math.min(3,mods.sunder);effects.sunderUntil=state.time+2}
  if(mods.expose)effects.expose={owner:source.owner,sourceId:source.id,stacks:Math.min(4,mods.expose),until:state.time+1.5};
  if(mods.disruption){
   effects.slowStrength=Math.min(.45,.08*mods.disruption);
   effects.slowUntil=state.time+.6;
  }
  if(mods.burning){
   effects.burn={source,dps:Math.min(12,2*mods.burning),until:state.time+2};
  }
  if(mods.hazardous){
   // At most two active patches per fighter prevent rapid attacks from flooding the arena.
   const own=state.zones.filter(z=>z.source.id===source.id);
   if(own.length>=2){
    const oldest=own.sort((a,b)=>a.until-b.until)[0];
    state.zones.splice(state.zones.indexOf(oldest),1);
   }
   state.zones.push({x:target.x,y:target.y,owner:source.owner,source,
    radius:18+Math.min(4,mods.hazardous)*3,dps:Math.min(10,2*mods.hazardous),until:state.time+2.5});
  }
  source.lastAttacked=target.id;source.lastAttackAt=state.time;
 }
 if(state.zones.length>60)state.zones.splice(0,state.zones.length-60);
 return output;
}
function environmentalAttacks(state,dt){
 const hits=[];
 for(const u of state.units){
  if(u.hp<=0)continue;
  const burn=u.effects?.burn;
  if(burn&&burn.until>state.time&&burn.source){
   hits.push({source:burn.source,target:u,rawDamage:burn.dps*dt,
    damage:burn.dps*dt,indirect:true});
  }
 }
 state.zones=state.zones.filter(z=>z.until>state.time);
 for(const z of state.zones)for(const u of state.units){
  if(u.hp>0&&u.owner!==z.owner&&distance(u,z)<z.radius+CHASSIS[u.type].radius){
   hits.push({source:z.source,target:u,rawDamage:z.dps*dt,damage:z.dps*dt,indirect:true});
  }
 }
 return hits;
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
const attacks=[],wasAlive=new Set(state.units.filter(u=>u.hp>0).map(u=>u.owner));for(const u of state.units){if(u.hp<=0)continue;u.stateTime=state.time;const st=stats(u);if(u.chassis.passives.includes('regen'))u.hp=Math.min(u.maxHp,u.hp+2*dt);u.cd-=dt;const enemies=state.units.filter(e=>e.hp>0&&e.owner!==u.owner);if(!enemies.length)continue;const t=chooseTarget(state,u,enemies);if(!t)continue;u.focus=t.id;const awareness=tacticalAssessment(state,u,t,st,enemies);
 reactToThreat(state,u,t,st,awareness);
 const activeStats=stats(u);
 const d=distance(u,t),visible=clearLine(u,t,state.arena),inRange=d<=activeStats.range&&visible;
 if(!u.attack){
  // Facing follows a target smoothly while moving; windup later locks the direction.
  const desired=Math.atan2(t.y-u.y,t.x-u.x);
  const delta=Math.atan2(Math.sin(desired-u.facing),Math.cos(desired-u.facing));
  u.facing+=Math.max(-dt*10,Math.min(dt*10,delta));
 }
 if(!u.attack&&inRange&&u.cd<=0)startAttack(state,u,t);
 // Committed attacks reduce movement; only an emergency Dodge can cancel windup.
 if(!u.attack)utilityMove(state,u,t,activeStats,dt,enemies,awareness);
 const direction=chooseMovement(state,u,t,activeStats,enemies,dt);
 u.moveDecision=direction;u.moveTarget=t.id;
 if(state.diagnostics){const d=state.diagnostics;const record=d.units[u.id]||(d.units[u.id]={owner:u.owner,type:u.type,frames:0,idle:0,blocked:0,replans:0,stuck:0,waypointChanges:0,collisionLoss:0,intended:0,actual:0,attackOpportunities:0,shots:0,damage:0,routeProgress:0,reversals:0,reasonCounts:{},samples:[]});
 record.frames++;if(!direction.x&&!direction.y)record.idle++;if(u.navigationBlocked)record.blocked++;
 const route=u.navigation,waypoint=route?.path?.[0];const key=waypoint?Math.round(waypoint.x)+','+Math.round(waypoint.y):'none';
 if(record.lastWaypoint!==undefined&&record.lastWaypoint!==key)record.waypointChanges++;record.lastWaypoint=key;
 if(record.lastRoute&&route!==record.lastRoute){record.replans++;const reason=record.lastTarget!==t.id?'target-changed':u.navRecoverUntil>state.time?'stuck-recovery':'route-invalid-or-destination';record.reasonCounts[reason]=(record.reasonCounts[reason]||0)+1}record.lastRoute=route;record.lastTarget=t.id;
 if((u.navStuckCount||0)>record.stuck){record.stuck=u.navStuckCount;record.reasonCounts.stuck=(record.reasonCounts.stuck||0)+1}
 if(record.lastDirection&&direction.x*record.lastDirection.x+direction.y*record.lastDirection.y<-.5)record.reversals++;record.lastDirection={x:direction.x,y:direction.y};
 if(inRange)record.attackOpportunities++;
 record.before={x:u.x,y:u.y,step:activeStats.speed*dt*attackMovementMultiplier(u),seeking:!inRange,waypointDistance:waypoint?distance(u,waypoint):null};
 }
 if(direction.x||direction.y){const step=activeStats.speed*dt*attackMovementMultiplier(u);u.move={x:direction.x,y:direction.y};u.x+=direction.x*step;u.y+=direction.y*step;bound(u,state.arena)}
 if(u.attack){if(state.diagnostics&&u.attack.phase==='windup'&&u.attack.elapsed+dt>=ATTACK_TIMING[u.type].windup)state.diagnostics.units[u.id].shots++;advanceAttack(state,u,t,activeStats,dt,attacks)}}
 resolveCollision(state);
 for(const u of state.units){
  const path=u.motion||(u.motion=[]);
  path.push({time:state.time,x:u.x,y:u.y});
  while(path.length>2&&path[1].time<state.time-2)path.shift();
 }
 if(state.diagnostics){for(const u of state.units){const record=state.diagnostics.units[u.id];if(!record?.before)continue;const before=record.before,actual=distance(before,u);record.actual+=actual;record.intended+=before.step*(record.lastDirection.x||record.lastDirection.y?1:0);if(before.step>0&&actual<before.step*.2&&(record.lastDirection.x||record.lastDirection.y))record.collisionLoss++;if(before.seeking&&before.step>0&&(record.lastDirection.x||record.lastDirection.y)&&actual<before.step*.2)record.pursuitStallFrames=(record.pursuitStallFrames||0)+1;else record.pursuitStallFrames=0;record.maxPursuitStallFrames=Math.max(record.maxPursuitStallFrames||0,record.pursuitStallFrames);if(before.waypointDistance!==null&&u.navigation?.path?.[0])record.routeProgress+=before.waypointDistance-distance(u,u.navigation.path[0]);delete record.before;
 if(state.tick%30===0&&record.samples.length<35)record.samples.push({t:Math.round(state.time),x:Math.round(u.x),y:Math.round(u.y),idle:record.idle,blocked:record.blocked,stuck:record.stuck});}}
 advanceProjectiles(state,dt,attacks);
 // Evasion blocks impacts and their on-hit effects before any status is applied.
 const landed=attacks.filter(a=>{
  if(a.target.evadingUntil<=state.time)return true;
  a.target.combatStats&&(a.target.combatStats.evaded++);
  return false;
 });
 const resolved=resolveAttackModules(state,landed).concat(environmentalAttacks(state,dt));
 // Preserve a visual distinction between direct hits and fractional DoT ticks.
 const directTargets=new Set(resolved.filter(a=>!a.indirect).map(a=>a.target));
 const totals=new Map();
 for(const a of resolved){
  // Estimate the defense prevented by a timed Bulwark rather than counting
  // hypothetical dodged damage as prevention.
  if(a.target.bulwarkUntil>state.time&&a.target.combatStats){
   const base=CHASSIS[a.target.type].defense+(a.target.chassis.passives.includes('bulwark')?0:0);
   const legacy=a.target.chassis.mods||{};
   const raw=a.rawDamage??a.damage;
   const prevented=Math.max(0,Math.max(1,raw-base)-a.damage);
   a.target.combatStats.prevented+=prevented;
  }
  if(a.projectile&&a.source.combatStats)a.source.combatStats.hits++;
  const prior=totals.get(a.target)||0;
  const dealt=Math.max(0,Math.min(a.damage,a.target.hp-prior));
  if(dealt>0){
   state.damageDealt[a.source.owner]+=dealt;
   a.source.combatStats&&(a.source.combatStats.damage+=dealt);
   if(state.diagnostics&&state.diagnostics.units[a.source.id])state.diagnostics.units[a.source.id].damage+=dealt;
  }
  totals.set(a.target,prior+a.damage);
 }
 // Retaliation answers a landed direct melee hit, not projectiles, chain or hazards.
 for(const hit of resolved){
  if(!hit.projectile&&!hit.secondary&&!hit.indirect&&hit.damage>0&&
     hit.target.hp>0&&hit.target.chassis.passives.includes('retaliation')){
   hit.target.retaliationReady=state.time+4;
  }
 }
 for(const [target,damage] of totals){
  const applied=Math.min(target.hp,damage);target.hp=Math.max(0,target.hp-damage);
  target.combatStats&&(target.combatStats.damageTaken+=applied);
  if(applied>0)state.visualEvents.push({kind:directTargets.has(target)?'damage':'dotDamage',
   targetId:target.id,x:target.x,y:target.y,value:applied,owner:target.owner});
 }// Taunt begins on a landed attack. Repeated hits refresh the duration; stacks increase it.
 // Multiple simultaneous taunts resolve deterministically in attack processing order.
 for(const a of resolved){if(a.taunt>0&&a.source.hp>0&&a.target.hp>0){a.target.tauntedBy=a.source.id;a.target.tauntedUntil=state.time+.25*a.taunt}}
 for(const a of resolved){if(a.knockback&&a.target.hp>0){const d=Math.max(1,distance(a.source,a.target));a.target.x+=(a.target.x-a.source.x)/d*a.knockback*4;a.target.y+=(a.target.y-a.source.y)/d*a.knockback*4;bound(a.target,state.arena)}}
 for(const u of state.units)if(u.hp===0&&!u.reported){u.reported=true;state.events.push(state.players[u.owner].name+' '+CHASSIS[u.type].name+' defeated');}
 const nowAlive=new Set(state.units.filter(u=>u.hp>0).map(u=>u.owner));for(const owner of wasAlive)if(!nowAlive.has(owner)){state.eliminations.push({owner,tick:state.tick});state.events.push(state.players[owner].name+' team eliminated')}
 if(nowAlive.size<=1||state.time>=DURATION)return [...nowAlive];return null}
export function placementGroups(state){const active=state.players.map((p,i)=>p.hp>0?i:-1).filter(i=>i>=0);const alive=active.filter(i=>state.units.some(u=>u.owner===i&&u.hp>0));const dead=active.filter(i=>!alive.includes(i));const groups=[];const survivors=[...alive].sort((a,b)=>teamPercent(state,b)-teamPercent(state,a));for(const i of survivors){const score=teamPercent(state,i),last=groups.at(-1);if(last&&last[0].survivor&&Math.abs(last[0].score-score)<1e-9)last.push({owner:i,score,survivor:true});else groups.push([{owner:i,score,survivor:true}])}
 const deathTicks=new Map(state.eliminations.map(e=>[e.owner,e.tick]));dead.sort((a,b)=>(deathTicks.get(b)||0)-(deathTicks.get(a)||0));for(const i of dead){const score=deathTicks.get(i)||0,last=groups.at(-1);if(last&&!last[0].survivor&&last[0].score===score)last.push({owner:i,score,survivor:false});else groups.push([{owner:i,score,survivor:false}])}return groups.map(g=>g.map(x=>x.owner))}
export function placementDamage(round,place,activeCount,streak){if(place===1)return 0;const base=3+(place-2)*3;return Math.round(base*(1+Math.max(0,round-1)*.35)*(1+Math.max(0,streak)*.15))}
export function resolvePlayerHP(players,ranking,round){const bottom=Math.floor(ranking.length/2);for(let place=1;place<=ranking.length;place++){const p=players[ranking[place-1]];const losing=place>ranking.length-bottom;p.streak=losing?(p.streak||0)+1:0;p.hp=Math.max(0,p.hp-placementDamage(round,place,ranking.length,losing?p.streak-1:0))}return players}
