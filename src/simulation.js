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
// Attack modules are composed by stage, not treated as interchangeable procs.
// Geometric/conditional effects work per hit; persistent aftermath has an
// independent activation window per chassis, shared by every hit of one release.
export const ATTACK_STAGES={
 projectiles:{stage:'shape',label:'Spread lanes'},
 piercing:{stage:'shape',label:'Extra targets'},
 area:{stage:'shape',label:'Hit footprint'},
 range:{stage:'shape',label:'Reach'},
 chain:{stage:'shape',label:'Secondary target / damage redistribution'},
 knockback:{stage:'impact',label:'Displacement'},
 followthrough:{stage:'impact',label:'Follow-through displacement',cooldown:.75},
 taunt:{stage:'aftermath',label:'Target override'},
 sunder:{stage:'aftermath',label:'Defense reduction'},
 expose:{stage:'aftermath',label:'Ally-consumable mark'},
 disruption:{stage:'aftermath',label:'Movement slow'},
 precision:{stage:'condition',label:'Healthy-target damage'},
 momentum:{stage:'condition',label:'Recent movement damage'},
 burning:{stage:'aftermath',label:'Damage over time',cooldown:1},
 hazardous:{stage:'aftermath',label:'Persistent ground',cooldown:1},
 disengage:{stage:'aftermath',label:'Post-attack retreat',duration:.5},
 restless:{stage:'targeting',label:'Recent-hit target avoidance'}
};
// Returns true for all targets struck by the SAME committed attack; other
// attacks respect the independent cooldown. Projectile volleys can arrive
// across multiple simulation ticks without multiplying the proc rate.
export function claimAttackEffect(source,key,attackId,now){
 const cooldown=ATTACK_STAGES[key]?.cooldown||0;
 if(!cooldown)return true;
 const active=source.effectActivations||(source.effectActivations={});
 const previous=active[key];
 if(previous&&attackId!=null&&previous.attackId===attackId)return true;
 if(previous&&now+1e-8<previous.until)return false;
 active[key]={attackId,until:now+cooldown};
 return true;
}

export const WIDTH=720,HEIGHT=520,STEP=1/30,DURATION=30;
export const ATTACK_TIMING={bruiser:{windup:.30,recovery:.22,lock:.5,windupMove:.18,recoveryMove:.55,arc:95},rogue:{windup:.18,recovery:.12,lock:.5,windupMove:.3,recoveryMove:.75,arc:35},ranged:{windup:.24,recovery:.18,lock:.5,windupMove:.22,recoveryMove:.55,arc:0}};
export function rng(seed=12345){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
export function makeChassis(type){if(!CHASSIS[type])throw Error('Unknown chassis');return {type,mods:{hp:0,damage:0,speed:0,rate:0,range:0,projectiles:0,piercing:0,area:0,knockback:0,taunt:0,dash:0,dodge:0,backstep:0,flank:0,disengage:0,intercept:0,followthrough:0,range:0,sunder:0,precision:0,expose:0,disruption:0,momentum:0,chain:0,burning:0,hazardous:0,restless:0},weights:Object.fromEntries(METRICS.map((m,i)=>[m,BASE_WEIGHTS[type][i]])),passives:[],modules:[]}}
export function squadStatMultiplier(size=1){return Math.max(.7,1-.15*Math.max(0,Math.min(3,size)-1))}
export function stats(u){const c=CHASSIS[u.type],m=u.chassis.mods,mult=squadStatMultiplier(u.squadSize??1);return {hp:c.hp*mult+m.hp*20,damage:c.damage*mult+m.damage*2,speed:(c.speed+m.speed*18)*(u.hasteUntil>u.stateTime?1.4:1)*(u.effects?.slowUntil>u.stateTime?1-Math.min(.45,u.effects.slowStrength||0):1),range:c.range+m.range*8,rate:c.rate/(1+m.rate*.15)/(u.focusUntil>u.stateTime?1.35:1),defense:c.defense+(u.bulwarkUntil>u.stateTime?5:0),radius:c.radius,projectiles:1+m.projectiles,piercing:m.piercing,area:m.area,knockback:m.knockback,taunt:m.taunt||0,dash:m.dash||0,dodge:m.dodge||0,backstep:m.backstep||0,flank:m.flank||0,disengage:m.disengage||0,intercept:m.intercept||0,followthrough:m.followthrough||0,delivery:c.delivery}}
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
 return (u.maxHp||CHASSIS[u.type].hp)*(brace?1.5:1+normalized);
}
export function resolveCollision(state){
 const units=state.units.filter(u=>u.hp>0);
 for(let pass=0;pass<2;pass++)for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){
  const a=units[i],b=units[j],min=CHASSIS[a.type].radius+CHASSIS[b.type].radius+5;
  let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
  if(d>=min-1e-6)continue;
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
export function teamPercent(state,owner){const team=state.units.filter(u=>u.owner===owner);const max=team.reduce((n,u)=>n+u.maxHp,0);return max?team.reduce((n,u)=>n+Math.max(0,u.hp),0)/max:0}
// Randomize the *owner-to-corner assignment*, not just the arena orientation.
// When a prior assignment is supplied, no player repeats their previous corner.
export function spawnSlots(seed,previousSlots=null){
 const random=rng(seed),permutations=[];
 for(let a=0;a<4;a++)for(let b=0;b<4;b++)if(b!==a)for(let c=0;c<4;c++)if(c!==a&&c!==b)for(let d=0;d<4;d++)if(d!==a&&d!==b&&d!==c)permutations.push([a,b,c,d]);
 const eligible=previousSlots?.length===4?permutations.filter(p=>p.every((slot,i)=>slot!==previousSlots[i])):permutations;
 return eligible[Math.floor(random()*eligible.length)].slice()
}
export function spawn(players,arena=ARENAS[0],seed=1,round=1,previousSlots=null){const starts=[[110,100],[610,100],[610,420],[110,420]],random=rng(seed),slots=spawnSlots(seed+round*37,previousSlots);return {phase:'fight',time:0,tick:0,events:[],visualEvents:[],arena,spawnSlots:slots.slice(),units:players.flatMap((p,i)=>p.hp<=0?[]:p.squad.map((chassis,j)=>{const type=chassis.type,base=starts[slots[i%4]],u={id:i*100+j,owner:i,type,chassis,squadSize:p.squad.length,x:base[0]+(j%3-1)*33,y:base[1]+(Math.floor(j/3)-1)*30,cd:random()*.25,motion:[],effects:{},lastAttacked:null,lastAttackAt:-100,retaliationReady:0,effectActivations:{},disengageUntil:0,followthroughAt:0,followthroughCommit:null,focus:null,tauntedBy:null,tauntedUntil:0,facing:0,attack:null,mobilityCd:{},reactionCd:{},stateTime:0,hasteUntil:0,focusUntil:0,bulwarkUntil:0,combatStats:{damage:0,damageTaken:0,moduleDamage:{},moduleHits:{},attacks:0,shots:0,hits:0,wallHits:0,interceptions:0,dodges:0,evaded:0,prevented:0,haste:0,focus:0,bulwark:0},evadingUntil:0,phasingUntil:0,hp:1,maxHp:1,attacker:null};const st=stats(u);u.hp=u.maxHp=st.hp;bound(u,arena);return u})),players,eliminations:[],damageDealt:players.map(()=>0),zones:[],projectiles:[],nextProjectileId:1,nextAttackId:1,random}}
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
  const attackId=state.nextAttackId++;
  if(st.delivery==='projectile'){
   const dx=Math.cos(attack.direction),dy=Math.sin(attack.direction);
   spawnProjectileVolley(state,u,{id:attack.targetId,x:u.x+dx*st.range,y:u.y+dy*st.range},st,attack.direction,attackId);
  }else{
   const victims=meleeAttackTargets(state,u,attack.direction,st);
   for(let i=0;i<victims.length;i++){
    const victim=victims[i];
    const bearing=Math.atan2(victim.y-u.y,victim.x-u.x);
    const diff=Math.abs(Math.atan2(Math.sin(bearing-attack.direction),Math.cos(bearing-attack.direction)));
    const radius=CHASSIS[victim.type].radius,dist=Math.max(1,distance(u,victim));
    const baseArc=ATTACK_TIMING[u.type].arc*Math.PI/360+
     Math.asin(Math.min(.98,radius/dist));
    const deliveredBy=[];
    if(i>0&&st.piercing>0)deliveredBy.push('piercing');
    // A spread lane can reach outside the original, unmodified attack cone.
    if(st.projectiles>1&&diff>baseArc&&st.area===0)deliveredBy.push('projectiles');
    if(st.area>0&&(diff>baseArc||dist>st.range+radius))deliveredBy.push('area');
    if(st.range>CHASSIS[u.type].range&&dist>CHASSIS[u.type].range+st.area*9+radius)deliveredBy.push('range');
    attacks.push({source:u,target:victim,attackId,attackOrigin:{x:u.x,y:u.y},attackDirection:attack.direction,rawDamage:st.damage,
     damage:Math.max(1,st.damage-stats(victim).defense),
     knockback:st.knockback,taunt:st.taunt,deliveredBy});
   }
  }
  u.cd+=st.rate;
  if(u.chassis.mods.disengage){
   u.disengageUntil=state.time+.5;
   u.navigation=null;u.navProgress=null;
   state.visualEvents.push({kind:'reaction',ability:'disengage',x:u.x,y:u.y,owner:u.owner});
  }
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
// Utility movement only; attack-driven Follow Through remains unchanged.
export const UTILITY_MOVE_SCALE=1.3;
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
function spawnProjectileVolley(state,u,t,st,aimAngle=null,attackId=null){
 const count=Math.min(st.projectiles,9),spacing=.22;
 const angle=aimAngle??Math.atan2(t.y-u.y,t.x-u.x);
 const volley={hitIds:new Set(),attackId:attackId??state.nextAttackId++,origin:{x:u.x,y:u.y},direction:angle};
 state.projectiles ||= [];
 for(let i=0;i<count;i++){
  const offset=i===0?0:(i%2?1:-1)*Math.ceil(i/2)*spacing;
  const heading=angle+offset;
  u.combatStats&&(u.combatStats.shots++);
  state.projectiles.push({
   id:state.nextProjectileId++,owner:u.owner,source:u,aimedAtId:t.id,lane:i,landedCount:0,
   x:u.x,y:u.y,vx:Math.cos(heading),vy:Math.sin(heading),
   speed:PROJECTILE_SPEED,remaining:st.range,distanceTraveled:0,radius:PROJECTILE_RADIUS+Math.max(0,st.area)*3,damage:st.damage,
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
   shot.remaining-=moved;shot.distanceTraveled=(shot.distanceTraveled||0)+moved;travel-=moved;
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
    const deliveredBy=[];
    if(shot.source.chassis.mods.range>0&&
       shot.distanceTraveled>CHASSIS[shot.source.type].range)deliveredBy.push('range');
    if(shot.source.chassis.mods.area>0&&
       distance(shot,victim)>CHASSIS[victim.type].radius+PROJECTILE_RADIUS+1e-6)deliveredBy.push('area');
    if(shot.lane>0)deliveredBy.push('projectiles');
    if(shot.landedCount>0&&shot.source.chassis.mods.piercing>0)deliveredBy.push('piercing');
    shot.landedCount++;
    if(shot.source.combatStats&&victim.id!==shot.aimedAtId)shot.source.combatStats.interceptions++;
    attacks.push({source:shot.source,target:victim,projectile:true,attackId:shot.volley.attackId,
     attackOrigin:shot.volley.origin,attackDirection:shot.volley.direction,
     rawDamage:shot.damage,damage:Math.max(1,shot.damage-stats(victim).defense),
     knockback:shot.knockback,taunt:shot.taunt,deliveredBy});
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
// Deliberate holding is a tactical option, not an inactivity timer.
// Only favor it when combat is available here or an opponent is actually
// advancing into this position. A distant or stationary enemy must be pursued.
export function holdingOpportunity(state,u,target,st,enemies){
 const d=distance(u,target),visible=clearLine(u,target,state.arena);
 if(!visible)return 0;
 const targetRadius=CHASSIS[target.type].radius;
 // An enemy's collision radius is not attack access: attack initiation in
 // tick() requires center distance <= st.range. Otherwise two melee fighters
 // can both 'hold' a position where neither is actually able to attack.
 const striking=d<=st.range;
 const desired=st.range*.82;
 // Standing in melee range is useful; ranged fighters threatened at point
 // blank range must remain free to seek a safer firing position.
 const tooClose=u.type==='ranged'&&d<desired*.65;
 const incoming=enemies.some(e=>e.hp>0&&e!==target&&distance(u,e)<stats(e).range+CHASSIS[u.type].radius+12);
 if(tooClose||incoming)return 0;
 let approach=0;
 if(!striking&&d<st.range+targetRadius+110){
  const history=(target.motion||[]).filter(p=>p.time>=state.time-.65);
  let vx=0,vy=0;
  if(history.length>1){
   const first=history[0],last=history[history.length-1],elapsed=last.time-first.time;
   if(elapsed>.05){vx=(last.x-first.x)/elapsed;vy=(last.y-first.y)/elapsed}
  }else if(target.moveDecision){
   const dir=target.moveDecision;
   vx=dir.x*stats(target).speed;vy=dir.y*stats(target).speed;
  }
  const toward=((u.x-target.x)*vx+(u.y-target.y)*vy)/Math.max(1,d);
  const future={x:target.x+vx*.9,y:target.y+vy*.9};
  const futureD=distance(u,future);
  if(toward>stats(target).speed*.18&&futureD<=st.range+targetRadius+20)
   approach=Math.min(1,(d-futureD)/Math.max(1,stats(target).speed*.5));
 }
 if(!striking&&!approach)return 0;
 const exposed=enemies.some(e=>e.hp>0&&e!==target&&
  clearLine(e,u,state.arena)&&distance(e,u)<=stats(e).range+CHASSIS[u.type].radius);
 const exposedPenalty=exposed?.2:0;
 const inRangeBonus=striking?.23:0;
 const incomingBonus=approach*.5;
 const stableBonus=(u.previouslyHolding? .12:0);
 // Standing in the wrong range isn't a good defensive position.
 const tooNear=striking&&d<Math.min(desired*.55,CHASSIS[u.type].radius+targetRadius+5);
 // Holding must not override deliberately extreme targeting weights: a
 // distance-focused fighter can press forward, a safety-focused one retreat.
 const w=u.chassis.weights;
 const preferenceScale=1+Math.max(0,(w.distance||0)-1)*.75+
  Math.max(0,(w.safety||0)-1)*.75;
 return Math.max(0,inRangeBonus+incomingBonus+stableBonus-exposedPenalty-(tooNear?.17:0))/preferenceScale;
}
// Support a real ally engagement, not merely an ally having selected a target.
// In particular, a distant team with reciprocal target focus must still pursue
// normally instead of treating everyone else as already engaged.
export function cooperativeEngagement(state,u,st,enemies){
 const allies=state.units.filter(a=>a!==u&&a.hp>0&&a.owner===u.owner);
 if(!allies.length||u.attack||u.followthroughCommit?.until>state.time||
    u.disengageUntil>state.time)return null;
 // No coordination override for a fighter already able to attack something.
 if(enemies.some(e=>clearLine(u,e,state.arena)&&
    distance(u,e)<=st.range))return null;
 const wasIdle=u.supportNavigation!=null||u.previouslyHolding||u.holdingPosition||
  (!u.moveDecision?.x&&!u.moveDecision?.y)||
  recentMovement(u,state.time)<Math.max(2,st.speed*.08);
 if(!wasIdle)return null;
 const options=[];
 for(const ally of allies){
  const enemy=enemies.find(e=>e.id===ally.focus);
  if(!enemy)continue;
  const ast=stats(ally),d=distance(ally,enemy);
  const visible=clearLine(ally,enemy,state.arena);
  const attacking=!!ally.attack||(ally.lastAttackAt!=null&&state.time-ally.lastAttackAt<1.1);
  const inReach=visible&&d<=ast.range+CHASSIS[enemy.type].radius+10;
  const intent=ally.moveDecision||{x:0,y:0};
  const pursuit=(enemy.x-ally.x)*intent.x+(enemy.y-ally.y)*intent.y;
  const activelyClosing=visible&&d<290&&pursuit>Math.max(8,d*.2);
  if(!attacking&&!inReach&&!activelyClosing)continue;
  const dx=(enemy.x-ally.x)/Math.max(1,d),dy=(enemy.y-ally.y)/Math.max(1,d);
  const side=(u.id+ally.id)%2?1:-1;
  const screen=st.hp>=ast.hp*1.12&&st.range<ast.range*.9;
  let point;
  if(screen){
   const forward=Math.min(85,Math.max(34,d*.45));
   point={x:ally.x+dx*forward,y:ally.y+dy*forward};
  }else{
   const reach=Math.max(st.radius+CHASSIS[enemy.type].radius+7,st.range*.78);
   const flank=Math.min(42,Math.max(23,st.radius+ast.radius+5));
   point={x:enemy.x-dx*reach-dy*side*flank,
    y:enemy.y-dy*reach+dx*side*flank};
  }
  const r=st.radius+3;
  point.x=clamp(point.x,20+r,700-r);point.y=clamp(point.y,20+r,500-r);
  if(state.arena.obstacles.some(o=>rectHit(point.x,point.y,r+2,o)))continue;
  // Avoid forming a pile or abandoning an active personal engagement.
  const crowded=allies.filter(a=>a!==ally&&a.supportingAlly===ally.id&&distance(a,point)<65).length;
  const score=(attacking?3:inReach?2:1)+
    (screen&&ally.type==='ranged'?1:0)-
    distance(u,point)*.005-crowded*1.7;
  options.push({allyId:ally.id,enemyId:enemy.id,point,
   mode:screen?'screen':'support',score});
 }
 options.sort((a,b)=>b.score-a.score||a.allyId-b.allyId);
 return options[0]||null;
}
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
 if(u.holdingPosition){
  u.navProgress=null;u.navMotion={x:u.x,y:u.y,time:state.time,stalls:0};
 }
 return {x:best.x,y:best.y};
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
   const travel=st.speed*.4*.85*UTILITY_MOVE_SCALE,r=CHASSIS[u.type].radius+3;
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
    state.visualEvents.push({kind:'mobility',ability:'dodge',owner:u.owner,type:u.type,x:old.x,y:old.y,toX:u.x,toY:u.y});
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
 const cds=u.mobilityCd||(u.mobilityCd={}),now=state.time,burst=st.speed*.4*UTILITY_MOVE_SCALE;
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
 if((context.close.length>0||context.melee.length>0)&&d<Math.max(85,st.range*.8))offer('backstep',{x:u.x-dx*110,y:u.y-dy*110},burst*(.75+.2*strength('backstep')),4.5);
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
 state.visualEvents.push({kind:'mobility',x:ox,y:oy,toX:u.x,toY:u.y,owner:u.owner,type:u.type,ability:best.key});
 return true;
}
// The after-attack Disengage module temporarily replaces ordinary movement
// preferences with maximum separation from nearby enemies. It remains subject
// to arena walls/obstacles and cannot initiate another attack until the window ends.
export function disengageDirection(state,u,enemies){
 if(!enemies.length)return {x:0,y:0};
 const candidates=[];
 const nearby=enemies.slice().sort((a,b)=>distance(u,a)-distance(u,b));
 const most=nearby[0],away=Math.atan2(u.y-most.y,u.x-most.x);
 for(const offset of [0,.35,-.35,.7,-.7,1.1,-1.1,1.5,-1.5,Math.PI]){
  const dir={x:Math.cos(away+offset),y:Math.sin(away+offset)};
  const step=stats(u).speed*STEP*(1+Math.min(.35,Math.max(0,u.chassis.mods.disengage-1)*.1));
  const end={x:u.x+dir.x*step,y:u.y+dir.y*step};
  const r=CHASSIS[u.type].radius+3;
  if(end.x<20+r||end.x>700-r||end.y<20+r||end.y>500-r)continue;
  if(!clearLine(u,end,state.arena,r))continue;
  if(state.arena.obstacles.some(o=>rectHit(end.x,end.y,r,o)))continue;
  const pressure=nearby.reduce((value,e)=>{
   const d=distance(u,e),next=distance(end,e);
   return value+(next-d)/(Math.max(35,d)*Math.max(1,Math.sqrt(d/65)));
  },0);
  const collision=state.units.filter(v=>v!==u&&v.hp>0).reduce((p,v)=>{
   const distanceTo=distance(end,v),buffer=CHASSIS[u.type].radius+CHASSIS[v.type].radius+8;
   return p+Math.max(0,buffer-distanceTo)*.04;
  },0);
  candidates.push({dir,score:pressure-collision+Math.cos(offset)*.001});
 }
 return candidates.sort((a,b)=>b.score-a.score)[0]?.dir||{x:0,y:0};
}
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
 const duration=.5;
 u.followthroughCommit={x:Math.cos(heading),y:Math.sin(heading),
  until:state.time+duration,started:state.time,attackId:hit.attackId,
  speedFactor:1+stacks*.12};
 // If both attack effects are equipped, complete the space-claim first,
 // then give Disengage its full independent retreat window.
 if(u.chassis.mods.disengage&&u.disengageUntil>state.time)
  u.disengageUntil=state.time+duration+.5;
 u.followthroughAt=state.time+.75;
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

// Attack effects act on actual impacts, never on visual commitment events.
function traveledRecently(u,now){
 const path=u.motion||[];let total=0;
 for(let i=1;i<path.length;i++)if(path[i].time>=now-2)total+=distance(path[i-1],path[i]);
 return Math.min(100,total);
}
// Credit directly measurable damage without pretending the engine can isolate the
// counterfactual value of positioning, CC, attack range, target choice or mobility.
export function resolveAttackModules(state,attacks){
 const output=[];
 for(const hit of attacks){
  if(hit.secondary||hit.indirect){output.push(hit);continue}
  const source=hit.source,target=hit.target,mods=source.chassis.mods;
  const effects=target.effects||(target.effects={}),contributions={};
  const add=(key,damage)=>{if(damage>0)contributions[key]=(contributions[key]||0)+damage};
  const initialRaw=hit.rawDamage??hit.damage,baseDefense=stats(target).defense;
  let raw=initialRaw;
  // Track marginal post-defense improvements in a fixed, reproducible order.
  const gain=(key,extra)=>{
   if(!extra)return;
   const before=Math.max(1,raw-baseDefense);
   raw+=extra;
   add(key,Math.max(0,Math.max(1,raw-baseDefense)-before));
  };
  if(mods.precision&&target.hp/target.maxHp>.75)gain('precision',mods.precision*2);
  if(mods.momentum)gain('momentum',mods.momentum*2*traveledRecently(source,state.time)/100);
  if(source.retaliationReady>state.time){gain('retaliation',4);source.retaliationReady=0}
  if(effects.expose&&effects.expose.until>state.time&&
     effects.expose.owner===source.owner&&effects.expose.sourceId!==source.id){
   gain('expose',2*effects.expose.stacks);effects.expose=null;
  }
  const sunderStrength=effects.sunderUntil>state.time?Math.min(3,effects.sunder||0):0;
  const defense=Math.max(0,baseDefense-sunderStrength);
  add('sunder',Math.max(0,Math.max(1,raw-defense)-Math.max(1,raw-baseDefense)));
  hit.rawDamage=raw;hit.damage=Math.max(1,raw-defense);
  const chained=mods.chain?state.units.filter(u=>u!==target&&u.hp>0&&u.owner!==source.owner&&
   distance(u,target)<=95&&clearLine(target,u,state.arena)).sort((a,b)=>distance(a,target)-distance(b,target)||a.id-b.id)[0]:null;
  const split=mods.chain?Math.min(.6,.2*mods.chain):0;
  hit.chainRedirected=hit.damage*split;
  hit.damage*=1-split;
  hit.moduleDamage=Object.fromEntries(Object.entries(contributions).map(([key,value])=>[key,value*(1-split)]));
  output.push(hit);
  if(chained){
   const damage=Math.max(0,raw*split-stats(chained).defense);
   output.push({source,target:chained,rawDamage:raw*split,
    damage,secondary:true,moduleDamage:{chain:damage}});
   state.visualEvents.push({kind:'chain',x:target.x,y:target.y,toX:chained.x,toY:chained.y,owner:source.owner});
  }
  if(mods.sunder){effects.sunder=Math.min(3,mods.sunder);effects.sunderUntil=state.time+2}
  if(mods.expose)effects.expose={owner:source.owner,sourceId:source.id,stacks:Math.min(4,mods.expose),until:state.time+1.5};
  if(mods.disruption){
   effects.slowStrength=Math.min(.45,.08*mods.disruption);
   effects.slowUntil=state.time+.6;
  }
  if(mods.burning&&claimAttackEffect(source,'burning',hit.attackId,state.time))
   effects.burn={source,dps:Math.min(12,2*mods.burning),until:state.time+2};
  if(mods.hazardous&&claimAttackEffect(source,'hazardous',hit.attackId,state.time)){
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
    damage:burn.dps*dt,indirect:true,moduleDamage:{burning:burn.dps*dt}});
  }
 }
 state.zones=state.zones.filter(z=>z.until>state.time);
 for(const z of state.zones)for(const u of state.units){
  if(u.hp>0&&u.owner!==z.owner&&distance(u,z)<z.radius+CHASSIS[u.type].radius){
   hits.push({source:z.source,target:u,rawDamage:z.dps*dt,damage:z.dps*dt,indirect:true,moduleDamage:{hazardous:z.dps*dt}});
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
  unit.intent=norm>1e-8?{x:prior.x/norm,y:prior.y/norm}:unit.holdingPosition?{x:0,y:0}:target?{x:(target.x-unit.x)/Math.max(1,distance(unit,target)),y:(target.y-unit.y)/Math.max(1,distance(unit,target))}:{x:0,y:0};
 }
const attacks=[],wasAlive=new Set(state.units.filter(u=>u.hp>0).map(u=>u.owner));for(const u of state.units){if(u.hp<=0)continue;u.stateTime=state.time;const st=stats(u);if(u.chassis.passives.includes('regen'))u.hp=Math.min(u.maxHp,u.hp+2*dt);u.cd-=dt;const enemies=state.units.filter(e=>e.hp>0&&e.owner!==u.owner);if(!enemies.length)continue;const t=chooseTarget(state,u,enemies);if(!t)continue;u.focus=t.id;const awareness=tacticalAssessment(state,u,t,st,enemies);
 reactToThreat(state,u,t,st,awareness);
 const activeStats=stats(u);
 const retreating=u.disengageUntil>state.time;
 if(!retreating&&u.disengageUntil&&u.disengageUntil<=state.time){
  u.disengageUntil=0;u.focus=null;u.navigation=null;u.navProgress=null;
 }
 const d=distance(u,t),visible=clearLine(u,t,state.arena),inRange=d<=activeStats.range&&visible;
 if(!u.attack){
  // Facing follows a target smoothly while moving; windup later locks the direction.
  const desired=Math.atan2(t.y-u.y,t.x-u.x);
  const delta=Math.atan2(Math.sin(desired-u.facing),Math.cos(desired-u.facing));
  u.facing+=Math.max(-dt*10,Math.min(dt*10,delta));
 }
 if(!u.attack&&!retreating&&!(u.followthroughCommit?.until>state.time)&&inRange&&u.cd<=0)startAttack(state,u,t);
 // Committed attacks reduce movement; only an emergency Dodge can cancel windup.
 const committing=u.followthroughCommit?.until>state.time-dt;
 if(!u.attack&&!retreating&&!committing)utilityMove(state,u,t,activeStats,dt,enemies,awareness);
 const direction=committing?{x:u.followthroughCommit.x,y:u.followthroughCommit.y}:
  retreating?disengageDirection(state,u,enemies):chooseMovement(state,u,t,activeStats,enemies,dt);
 if(committing||retreating)u.holdingPosition=false;
 u.moveDecision=direction;u.moveTarget=t.id;
 if(state.diagnostics){const d=state.diagnostics;const record=d.units[u.id]||(d.units[u.id]={owner:u.owner,type:u.type,frames:0,idle:0,blocked:0,replans:0,stuck:0,waypointChanges:0,collisionLoss:0,intended:0,actual:0,attackOpportunities:0,shots:0,damage:0,routeProgress:0,reversals:0,reasonCounts:{},samples:[]});
 record.frames++;if(!direction.x&&!direction.y)record.idle++;
 if(u.supportingAlly!=null){
  record.supportFrames=(record.supportFrames||0)+1;
  if(u.supportMode==='screen')record.screenFrames=(record.screenFrames||0)+1;
  if(u.holdingPosition)record.supportHoldFrames=(record.supportHoldFrames||0)+1;
 }
 if(u.holdingPosition){
  record.deliberateHolds=(record.deliberateHolds||0)+1;
  if(inRange)record.holdWithAttackAccess=(record.holdWithAttackAccess||0)+1;
  else record.holdAwaitingApproach=(record.holdAwaitingApproach||0)+1;
 }
 if(u.navigationBlocked)record.blocked++;
 const route=u.navigation,waypoint=route?.path?.[0];const key=waypoint?Math.round(waypoint.x)+','+Math.round(waypoint.y):'none';
 if(record.lastWaypoint!==undefined&&record.lastWaypoint!==key)record.waypointChanges++;record.lastWaypoint=key;
 if(record.lastRoute&&route!==record.lastRoute){record.replans++;const reason=record.lastTarget!==t.id?'target-changed':u.navRecoverUntil>state.time?'stuck-recovery':'route-invalid-or-destination';record.reasonCounts[reason]=(record.reasonCounts[reason]||0)+1}record.lastRoute=route;record.lastTarget=t.id;
 if((u.navStuckCount||0)>record.stuck){record.stuck=u.navStuckCount;record.reasonCounts.stuck=(record.reasonCounts.stuck||0)+1}
 if(record.lastDirection&&direction.x*record.lastDirection.x+direction.y*record.lastDirection.y<-.5)record.reversals++;record.lastDirection={x:direction.x,y:direction.y};
 if(inRange)record.attackOpportunities++;
 record.before={x:u.x,y:u.y,step:activeStats.speed*dt*(committing?(u.followthroughCommit.speedFactor):attackMovementMultiplier(u)),seeking:!inRange,waypointDistance:waypoint?distance(u,waypoint):null};
 }
 if(direction.x||direction.y){
  if(committing){advanceFollowthrough(state,u,dt)}
  else{const step=activeStats.speed*dt*(retreating?1+Math.min(.35,Math.max(0,u.chassis.mods.disengage-1)*.1):attackMovementMultiplier(u));u.x+=direction.x*step;u.y+=direction.y*step;bound(u,state.arena)}
  u.move=direction;
 }
 if(u.attack){if(state.diagnostics&&u.attack.phase==='windup'&&u.attack.elapsed+dt>=ATTACK_TIMING[u.type].windup)state.diagnostics.units[u.id].shots++;advanceAttack(state,u,t,activeStats,dt,attacks)}}
 resolveCollision(state);
 for(const u of state.units){
  if(u.followthroughStepStart){
   const commit=u.followthroughCommit;
   const before=u.followthroughStepStart;
   const progress=(u.x-before.x)*commit.x+(u.y-before.y)*commit.y;
   if(u.combatStats)u.combatStats.followthroughDistance=(u.combatStats.followthroughDistance||0)+Math.max(0,progress);
   delete u.followthroughStepStart;
  }

  const path=u.motion||(u.motion=[]);
  path.push({time:state.time,x:u.x,y:u.y});
  while(path.length>2&&path[1].time<state.time-2)path.shift();
 }
 if(state.diagnostics){for(const u of state.units){const record=state.diagnostics.units[u.id];if(!record?.before)continue;const before=record.before,actual=distance(before,u);record.actual+=actual;record.intended+=before.step*(record.lastDirection.x||record.lastDirection.y?1:0);if(before.step>0&&actual<before.step*.2&&(record.lastDirection.x||record.lastDirection.y))record.collisionLoss++;if(before.seeking&&before.step>0&&(record.lastDirection.x||record.lastDirection.y)&&actual<before.step*.2)record.pursuitStallFrames=(record.pursuitStallFrames||0)+1;else record.pursuitStallFrames=0;record.maxPursuitStallFrames=Math.max(record.maxPursuitStallFrames||0,record.pursuitStallFrames);if(before.waypointDistance!==null&&u.navigation?.path?.[0])record.routeProgress+=before.waypointDistance-distance(u,u.navigation.path[0]);delete record.before;
 if(state.tick%30===0&&record.samples.length<35)record.samples.push({t:Math.round(state.time),x:Math.round(u.x),y:Math.round(u.y),idle:record.idle,blocked:record.blocked,stuck:record.stuck});}}
 // This telemetry is opt-in and does not change AI decisions or reward kills.
 // Mutual passivity requires ALL active fighters to be holding outside an attack
 // opportunity, with no attack committed and no projectile in flight.
 if(state.diagnostics){
  const d=state.diagnostics,units=state.units.filter(u=>u.hp>0);
  const active=units.filter(u=>state.units.some(e=>e.hp>0&&e.owner!==u.owner));
  const holding=active.filter(u=>u.holdingPosition);
  const opportunity=active.some(u=>state.units.some(e=>e.hp>0&&e.owner!==u.owner&&
   clearLine(u,e,state.arena)&&distance(u,e)<=stats(u).range));
  const committed=active.some(u=>u.attack)||(state.projectiles||[]).length>0||attacks.length>0;
  const passive=active.length>=2&&holding.length===active.length&&!opportunity&&!committed;
  d.tactical||={frames:0,holdingUnitFrames:0,mutualPassiveFrames:0,
   maxMutualPassiveFrames:0,mutualPassiveStreak:0,productiveCombatFrames:0,
   attackReleases:0,holdWithAttackAccess:0,holdAwaitingApproach:0};
  const t=d.tactical;t.frames++;t.holdingUnitFrames+=holding.length;
  const holdingWithAccess=holding.filter(u=>state.units.some(e=>e.hp>0&&e.owner!==u.owner&&
   clearLine(u,e,state.arena)&&distance(u,e)<=stats(u).range)).length;
  t.holdWithAttackAccess+=holdingWithAccess;
  t.holdAwaitingApproach+=holding.length-holdingWithAccess;
  // Attack releases are fighter events, NOT the number of hit records.
  // This includes projectile launches and counts multi-target releases once.
  t.attackReleases=state.units.reduce((sum,u)=>sum+(u.combatStats?.attacks||0),0);
  t.supportUnitFrames=(t.supportUnitFrames||0)+active.filter(u=>u.supportingAlly!=null).length;
  t.screenUnitFrames=(t.screenUnitFrames||0)+active.filter(u=>u.supportMode==='screen').length;
  if(opportunity||committed)t.productiveCombatFrames++;
  if(passive){t.mutualPassiveFrames++;t.mutualPassiveStreak++}
  else t.mutualPassiveStreak=0;
  t.maxMutualPassiveFrames=Math.max(t.maxMutualPassiveFrames,t.mutualPassiveStreak);
 }
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
   const combat=a.source.combatStats;
   if(combat){
    combat.moduleDamage||={};
    combat.moduleHits||={};
    for(const [key,potential] of Object.entries(a.moduleDamage||{})){
     const credit=Math.min(dealt,potential*dealt/Math.max(1e-9,a.damage));
     if(credit>0)combat.moduleDamage[key]=(combat.moduleDamage[key]||0)+credit;
    }
    // Delivery-enabled impacts are tracked independently from damage bonuses:
    // a hit can be both a spread-lane hit and a pierced hit.
    for(const key of a.deliveredBy||[]){
     combat.moduleHits[key]=(combat.moduleHits[key]||0)+dealt;
    }
    if(a.chainRedirected)combat.chainRedirected=(combat.chainRedirected||0)+
     a.chainRedirected*dealt/Math.max(1e-9,a.damage);
   }
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
 // Impact displacement occurs only after evasion filtering and direct-hit resolution.
 // One melee release can hit many enemies but can trigger Follow Through once.
 resolveFollowthroughImpacts(state,resolved);
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
