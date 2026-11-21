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
export function chooseTarget(state,u,enemies){if(u.tauntedUntil>state.time){const forced=enemies.find(e=>e.id===u.tauntedBy);if(forced)return forced}const w=u.chassis.weights,allies=state.units.filter(a=>a.hp>0&&a.owner===u.owner&&a.id!==u.id),st=stats(u);let best=null,score=-Infinity;for(const e of enemies){const d=distance(u,e),ratio=healthFraction(e),enemyStats=stats(e),enemyAllies=state.units.filter(a=>a.hp>0&&a.owner===e.owner&&a.id!==e.id),isolated=enemyAllies.length?Math.min(...enemyAllies.map(a=>distance(a,e)))/200:1,nearAllies=allies.length?Math.min(...allies.map(a=>distance(a,e))):250;const features={kill:1-ratio,damage:st.damage/Math.max(1,e.hp),threat:enemyStats.damage/30+(e.focus===u.id?.5:0),distance:1-d/500,allyProximity:1-nearAllies/500,safety:d/500,protection:allies.some(a=>e.focus===a.id)?1:0,ability:u.cd<=0?1:0,isolation:clamp(isolated,0,1),preferredRange:1-Math.abs(d-st.range)/500};let value=METRICS.reduce((sum,k)=>sum+(w[k]||0)*features[k],0);if(u.focus===e.id)value+=.2;if(value>score){score=value;best=e}}return best}
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
export function spawn(players,arena=ARENAS[0],seed=1,round=1,previousSlots=null){const starts=[[110,100],[610,100],[610,420],[110,420]],random=rng(seed),slots=spawnSlots(seed+round*37,previousSlots);return {phase:'fight',time:0,tick:0,events:[],visualEvents:[],arena,spawnSlots:slots.slice(),units:players.flatMap((p,i)=>p.hp<=0?[]:p.squad.map((chassis,j)=>{const type=chassis.type,base=starts[slots[i%4]],u={id:i*100+j,owner:i,type,chassis,x:base[0]+(j%3-1)*33,y:base[1]+(Math.floor(j/3)-1)*30,cd:random()*.25,focus:null,tauntedBy:null,tauntedUntil:0,mobilityCd:{},evadingUntil:0,phasingUntil:0,hp:1,maxHp:1,attacker:null};const st=stats(u);u.hp=u.maxHp=st.hp;bound(u,arena);return u})),players,eliminations:[],random}}
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
function utilityMove(state,u,target,st,dt,enemies){
 const cds=u.mobilityCd||(u.mobilityCd={}),now=state.time;
 const ready=key=>(cds[key]||0)<=now;
 const move=(key,point,distanceUnits,cooldown,options={})=>{
  const d=distance(u,point);if(d<1||!clearLine(u,point,state.arena,CHASSIS[u.type].radius+3))return false;
  const step=Math.min(distanceUnits,d),ox=u.x,oy=u.y;
  u.x+=(point.x-u.x)/d*step;u.y+=(point.y-u.y)/d*step;
  bound(u,state.arena);
  if(distance(u,{x:ox,y:oy})<1)return false;
  cds[key]=now+cooldown;
  if(options.evade)u.evadingUntil=now+options.evade;
  if(options.phase){u.phasingUntil=now+dt+.01;u.phaseTarget=target.id}
  state.visualEvents.push({kind:'mobility',x:ox,y:oy,toX:u.x,toY:u.y,owner:u.owner,ability:key});
  return true
 };
 const d=distance(u,target),dx=target.x-u.x,dy=target.y-u.y,mag=Math.max(1,d);
 const nearest=enemies.reduce((best,e)=>Math.min(best,distance(u,e)),Infinity);
 const threatened=nearest<Math.max(55,st.range*.55);
 const safety=u.chassis.weights.safety||0,protection=u.chassis.weights.protection||0;
 // Intercept is a protective reposition, not a teleport to the enemy.
 if(st.intercept&&ready('intercept')&&protection>=.5){
  const allies=state.units.filter(a=>a.hp>0&&a.owner===u.owner&&a!==u);
  const ally=allies.find(a=>enemies.some(e=>distance(a,e)<65)&&distance(u,a)>65&&distance(u,a)<200);
  if(ally&&move('intercept',ally,Math.min(85,45+st.intercept*15),5))return true;
 }
 if(st.dodge&&ready('dodge')&&threatened&&u.hp<u.maxHp*.8){
  const side=(u.id%2?1:-1),point={x:u.x-dy/mag*side*100,y:u.y+dx/mag*side*100};
  if(move('dodge',point,28+st.dodge*12,5,{evade:.12+st.dodge*.04}))return true;
 }
 if(st.disengage&&ready('disengage')&&enemies.filter(e=>distance(u,e)<75).length>=2){
  const point={x:u.x-dx/mag*110,y:u.y-dy/mag*110};
  if(move('disengage',point,35+st.disengage*12,6))return true;
 }
 if(st.backstep&&ready('backstep')&&d<Math.max(55,st.range*.55)&&safety>=.3){
  const point={x:u.x-dx/mag*110,y:u.y-dy/mag*110};
  if(move('backstep',point,35+st.backstep*12,4.5))return true;
 }
 // Follow Through passes the selected target and suppresses only that target's
 // body collision for the remainder of this simulation tick.
 if(st.followthrough&&ready('followthrough')&&d<st.range+25&&d>10){
  const point={x:target.x+dx/mag*(CHASSIS[u.type].radius+CHASSIS[target.type].radius+22),y:target.y+dy/mag*(CHASSIS[u.type].radius+CHASSIS[target.type].radius+22)};
  if(move('followthrough',point,Math.min(120,45+st.followthrough*28),6,{phase:true}))return true;
 }
 if(st.dash&&ready('dash')&&d>st.range+35&&d<st.range+190){
  const point={x:target.x-dx/mag*Math.max(10,st.range*.7),y:target.y-dy/mag*Math.max(10,st.range*.7)};
  if(move('dash',point,45+st.dash*22,5))return true;
 }
 if(st.flank&&ready('flank')&&d>st.range*.7&&d<st.range+100){
  const side=u.id%2?1:-1;
  const point={x:target.x-dx/mag*st.range+side*(-dy/mag)*(35+st.flank*12),y:target.y-dy/mag*st.range+side*(dx/mag)*(35+st.flank*12)};
  if(move('flank',point,28+st.flank*10,4))return true;
 }
 return false;
}
export function tick(state,dt=STEP){if(state.phase!=='fight')return null;state.time+=dt;state.tick++;state.visualEvents=[];const attacks=[],wasAlive=new Set(state.units.filter(u=>u.hp>0).map(u=>u.owner));for(const u of state.units){if(u.hp<=0)continue;const st=stats(u);if(u.chassis.passives.includes('regen'))u.hp=Math.min(u.maxHp,u.hp+2*dt);u.cd-=dt;const enemies=state.units.filter(e=>e.hp>0&&e.owner!==u.owner);if(!enemies.length)continue;const t=chooseTarget(state,u,enemies);if(!t)continue;u.focus=t.id;utilityMove(state,u,t,st,dt,enemies);const d=distance(u,t),visible=clearLine(u,t,state.arena),inRange=d<=st.range&&visible;if(!u.nav||u.nav.target!==t.id||state.tick%10===0)u.nav={target:t.id,point:wayPoint(u,t,state.arena)};let destination=u.nav.point;if(u.chassis.weights.safety>1.8&&d<160){destination={x:u.x+(u.x-t.x),y:u.y+(u.y-t.y)}}else if(st.delivery==='projectile'&&d<st.range*.48){destination={x:u.x+(u.x-t.x),y:u.y+(u.y-t.y)}}else if(inRange)destination=u;const travel=distance(u,destination);if(travel>1){const attackPenalty=inRange?.25:1,step=Math.min(st.speed*dt*attackPenalty,travel);const desired={x:(destination.x-u.x)/travel,y:(destination.y-u.y)/travel};const dir=steerAroundAllies(state,u,desired,step);u.move=dir;u.x+=dir.x*step;u.y+=dir.y*step;bound(u,state.arena)}if(inRange&&u.cd<=0){const volley=targetsForAttack(state,u,t,st);if(st.delivery==='projectile')for(const angle of volley.lanes)state.visualEvents.push({kind:'projectile',x:u.x,y:u.y,toX:u.x+Math.cos(angle)*st.range,toY:u.y+Math.sin(angle)*st.range,owner:u.owner});for(const victim of volley.hits){attacks.push({source:u,target:victim,damage:Math.max(1,st.damage-stats(victim).defense),knockback:st.knockback,taunt:st.taunt});}u.cd+=st.rate}}
 resolveCollision(state);const totals=new Map();for(const a of attacks)if(!(a.target.evadingUntil>state.time))totals.set(a.target,(totals.get(a.target)||0)+a.damage);for(const [target,damage] of totals){const applied=Math.min(target.hp,damage);target.hp=Math.max(0,target.hp-damage);if(applied>0)state.visualEvents.push({kind:'damage',x:target.x,y:target.y,value:applied,owner:target.owner})}// Taunt begins on a landed attack. Repeated hits refresh the duration; stacks increase it.
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
