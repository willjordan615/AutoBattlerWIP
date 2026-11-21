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
export function bound(u,arena=ARENAS[0]){const r=CHASSIS[u.type].radius+3;u.x=clamp(u.x,20+r,700-r);u.y=clamp(u.y,20+r,500-r);for(const o of arena.obstacles){if(!rectHit(u.x,u.y,r,o))continue;const cx=clamp(u.x,o.x,o.x+o.w),cy=clamp(u.y,o.y,o.y+o.h);let dx=u.x-cx,dy=u.y-cy,d=Math.hypot(dx,dy);if(d<.0001){const sides=[{v:Math.abs(u.x-o.x),x:o.x-r,y:u.y},{v:Math.abs(u.x-(o.x+o.w)),x:o.x+o.w+r,y:u.y},{v:Math.abs(u.y-o.y),x:u.x,y:o.y-r},{v:Math.abs(u.y-(o.y+o.h)),x:u.x,y:o.y+o.h+r}].sort((a,b)=>a.v-b.v);u.x=sides[0].x;u.y=sides[0].y}else{u.x=cx+dx/d*r;u.y=cy+dy/d*r}u.x=clamp(u.x,20+r,700-r);u.y=clamp(u.y,20+r,500-r)}}
function segmentRect(a,b,o,pad=0){const dx=b.x-a.x,dy=b.y-a.y;let lo=0,hi=1;for(const [p,q] of [[-dx,a.x-(o.x-pad)],[dx,o.x+o.w+pad-a.x],[-dy,a.y-(o.y-pad)],[dy,o.y+o.h+pad-a.y]]){if(Math.abs(p)<1e-9){if(q<0)return false;continue}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false}return true}
export function clearLine(a,b,arena=ARENAS[0],pad=0){return !arena.obstacles.some(o=>segmentRect(a,b,o,pad))}
function wayPoint(u,target,arena){const clearance=CHASSIS[u.type].radius+5;if(clearLine(u,target,arena,clearance))return target;const corners=arena.obstacles.flatMap(o=>[{x:o.x-clearance-2,y:o.y-clearance-2},{x:o.x+o.w+clearance+2,y:o.y-clearance-2},{x:o.x-clearance-2,y:o.y+o.h+clearance+2},{x:o.x+o.w+clearance+2,y:o.y+o.h+clearance+2}]).filter(p=>p.x>25&&p.x<695&&p.y>25&&p.y<495);const nodes=[u,...corners,target],end=nodes.length-1,dist=nodes.map(()=>Infinity),prev=nodes.map(()=>-1),seen=new Set();dist[0]=0;while(seen.size<nodes.length){let at=-1;for(let i=0;i<nodes.length;i++)if(!seen.has(i)&&(at<0||dist[i]<dist[at]))at=i;if(at<0||!Number.isFinite(dist[at])||at===end)break;seen.add(at);for(let i=1;i<nodes.length;i++){if(seen.has(i)||i===at||!clearLine(nodes[at],nodes[i],arena,clearance))continue;const cost=dist[at]+distance(nodes[at],nodes[i]);if(cost<dist[i]){dist[i]=cost;prev[i]=at}}}if(!Number.isFinite(dist[end]))return target;let at=end;while(prev[at]>0)at=prev[at];return nodes[at]}
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
 const nearest=enemies.reduce((best,e)=>Math.min(best,distance(point,e)),Infinity);
 const threat=enemies.reduce((sum,e)=>{const r=distance(point,e),es=stats(e);return sum+(r<es.range+30?1:0)*es.damage/25},0);
 const threatenedAllies=allies.filter(a=>enemies.some(e=>e.focus===a.id||distance(e,a)<65));
 const allyDistance=allies.length?Math.min(...allies.map(a=>distance(point,a))):120;
 const protectionDistance=threatenedAllies.length?Math.min(...threatenedAllies.map(a=>distance(point,a))):120;
 const isolated=enemies.filter(e=>e!==target).every(e=>distance(point,e)>90);
 const rangeFit=1-Math.min(1,Math.abs(d-st.range*.85)/Math.max(60,st.range));
 const attack=visible&&d<=st.range?1:0;
 const features={
  kill:(1-healthFraction(target))*(attack?.9:.3),
  damage:attack?1:.12,
  threat:-threat*.5, // position: avoid exposure; targeting: prioritize dangerous enemies
  distance:1-Math.min(1,d/300),
  allyProximity:1-Math.min(1,allyDistance/180),
  safety:Math.min(1,nearest/130)-threat*.2,
  protection:threatenedAllies.length?1-Math.min(1,protectionDistance/180):0,
  ability:(u.cd<=0&&attack?1:0)+(st.dash&&d>st.range&&d<st.range+100?.2:0),
  isolation:isolated?.6:0,
  preferredRange:rangeFit
 };
 let score=METRICS.reduce((sum,k)=>sum+(w[k]||0)*features[k],0);
 // Small inertial preference avoids jitter and keeps neutral weights functional.
 score+=.08*(d<old?1:0)-.03*distance(u,point)/Math.max(1,st.speed);
 return score;
}
export function chooseMovement(state,u,target,st,enemies,dt){
 const step=st.speed*dt,clearance=CHASSIS[u.type].radius+3;
 const blocked=!clearLine(u,target,state.arena,clearance);
 // A wall is a navigation constraint, not a preference that weights may override.
 // Cache the first waypoint for the five-tick steering interval.
 const waypoint=blocked?wayPoint(u,target,state.arena):target;
 u.navigationBlocked=blocked;
 const goal=blocked?waypoint:target,goalDist=distance(u,goal);
 const angle=Math.atan2(goal.y-u.y,goal.x-u.x);
 const dirs=[{x:0,y:0}];
 for(let i=0;i<8;i++){const theta=angle+i*Math.PI/4;dirs.push({x:Math.cos(theta),y:Math.sin(theta)})}
 let best={x:0,y:0,score:-Infinity};
 for(const dir of dirs){
  const point={x:u.x+dir.x*step,y:u.y+dir.y*step};
  const r=CHASSIS[u.type].radius+3;
  if(point.x<20+r||point.x>700-r||point.y<20+r||point.y>500-r)continue;
  if(!clearLine(u,point,state.arena,clearance))continue;
  // While occluded, first solve the physical route. Tactical weights choose
  // among viable directions but cannot reward walking into a wall.
  const progress=goalDist-distance(point,goal);
  if(blocked&&progress<=0)continue;
  // A reachable attack position is worth pursuing even when defensive weights
  // favor standing still. While occluded, waypoint progress dominates local
  // tactical preferences; once visible, normal weight scoring resumes.
  const score=positionScore(state,u,target,point,st,enemies)+(blocked?progress*12:0);
  // Avoid infinite defensive stalling when a target is visible but outside
  // attack range. A minimum engagement bias does not dictate a chassis role.
  const engagement=(!blocked&&distance(u,target)>st.range)?(distance(u,target)-distance(point,target))*.035:0;
  const adjusted=score+engagement;
  if(adjusted>best.score+1e-8)best={...dir,score:adjusted};
 }
 // Navigation must not accept indefinite inaction against an unreachable enemy.
 // Follow the obstacle waypoint even when local tactical scoring favors holding.
 // Legitimate holds (in range and unobstructed) remain entirely weight-driven.
 if(blocked&&best.x===0&&best.y===0){
  const radius=CHASSIS[u.type].radius+3;
  const headings=[0,.2,-.2,.45,-.45,.8,-.8,1.2,-1.2,Math.PI];
  for(const offset of headings){
   const theta=angle+offset,dir={x:Math.cos(theta),y:Math.sin(theta)};
   const p={x:u.x+dir.x*step,y:u.y+dir.y*step};
   if(p.x<20+radius||p.x>700-radius||p.y<20+radius||p.y>500-radius)continue;
   if(clearLine(u,p,state.arena,clearance))return {...dir,score:0};
  }
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
 const ally=allies.find(a=>enemies.some(e=>distance(a,e)<65)&&distance(u,a)>65&&distance(u,a)<200);
 if(ally)offer('intercept',ally,burst*(.8+.2*st.intercept),5);
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
export function tick(state,dt=STEP){if(state.phase!=='fight')return null;state.time+=dt;state.tick++;state.visualEvents=[];const attacks=[],wasAlive=new Set(state.units.filter(u=>u.hp>0).map(u=>u.owner));for(const u of state.units){if(u.hp<=0)continue;const st=stats(u);if(u.chassis.passives.includes('regen'))u.hp=Math.min(u.maxHp,u.hp+2*dt);u.cd-=dt;const enemies=state.units.filter(e=>e.hp>0&&e.owner!==u.owner);if(!enemies.length)continue;const t=chooseTarget(state,u,enemies);if(!t)continue;u.focus=t.id;utilityMove(state,u,t,st,dt,enemies);const d=distance(u,t),visible=clearLine(u,t,state.arena),inRange=d<=st.range&&visible;const direction=(!u.moveDecision||state.tick%5===0||u.moveTarget!==t.id)?chooseMovement(state,u,t,st,enemies,dt):(u.moveDecision);
 u.moveDecision=direction;u.moveTarget=t.id;
 if(direction.x||direction.y){const step=st.speed*dt;u.move={x:direction.x,y:direction.y};u.x+=direction.x*step;u.y+=direction.y*step;bound(u,state.arena)}
 if(inRange&&u.cd<=0){const volley=targetsForAttack(state,u,t,st);if(st.delivery==='projectile')for(const angle of volley.lanes)state.visualEvents.push({kind:'projectile',x:u.x,y:u.y,toX:u.x+Math.cos(angle)*st.range,toY:u.y+Math.sin(angle)*st.range,owner:u.owner});for(const victim of volley.hits){attacks.push({source:u,target:victim,damage:Math.max(1,st.damage-stats(victim).defense),knockback:st.knockback,taunt:st.taunt});}u.cd+=st.rate}}
 resolveCollision(state);const totals=new Map();for(const a of attacks)if(!(a.target.evadingUntil>state.time)){const dealt=Math.min(a.damage,Math.max(0,a.target.hp));state.damageDealt[a.source.owner]+=dealt;totals.set(a.target,(totals.get(a.target)||0)+a.damage)}for(const [target,damage] of totals){const applied=Math.min(target.hp,damage);target.hp=Math.max(0,target.hp-damage);if(applied>0)state.visualEvents.push({kind:'damage',x:target.x,y:target.y,value:applied,owner:target.owner})}// Taunt begins on a landed attack. Repeated hits refresh the duration; stacks increase it.
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
