// Engine subsystem: round. See AGENTS.md for ownership and test routes.
import {rng,stats} from './stats.js?v=engine-360-r4';
import {ARENAS,radiusOf} from './config.js?v=engine-360-r4';
import {bound} from './geometry.js?v=engine-360-r4';

export function teamPercent(state,owner){const team=state.units.filter(u=>u.owner===owner);const max=team.reduce((n,u)=>n+u.maxHp,0);return max?team.reduce((n,u)=>n+Math.max(0,u.hp),0)/max:0}
// Randomize the *owner-to-corner assignment*, not just the arena orientation.
// When a prior assignment is supplied, no player repeats their previous corner.
export function spawnSlots(seed,previousSlots=null){
 const random=rng(seed),permutations=[];
 for(let a=0;a<4;a++)for(let b=0;b<4;b++)if(b!==a)for(let c=0;c<4;c++)if(c!==a&&c!==b)for(let d=0;d<4;d++)if(d!==a&&d!==b&&d!==c)permutations.push([a,b,c,d]);
 const eligible=previousSlots?.length===4?permutations.filter(p=>p.every((slot,i)=>slot!==previousSlots[i])):permutations;
 return eligible[Math.floor(random()*eligible.length)].slice()
}
// Regular polygons around the arena center, using only surviving owners.
// Seat IDs remain stable, even when a team has been eliminated.
function permutations(values){
 if(!values.length)return [[]];
 return values.flatMap((v,i)=>permutations(values.filter((_,j)=>j!==i)).map(p=>[v,...p]));
}
export function spawnFormation(players,arena=ARENAS[0],seed=1,previousSlots=null){
 const active=players.map((p,i)=>p.hp>0&&p.squad.length?i:-1).filter(i=>i>=0),n=active.length;
 const random=rng(seed),empty=()=>Array(players.length).fill(null);
 if(!n)return {slots:empty(),centers:empty(),points:empty()};
 const candidates=permutations(active.map((_,i)=>i));
 const sameCount=previousSlots?.filter(x=>x!==null&&x!==undefined).length===n;
 const changed=sameCount?candidates.filter(p=>p.every((slot,i)=>slot!==previousSlots[active[i]])):candidates;
 const choices=changed.length?changed:candidates;
 const ordered=choices.slice();const offset=Math.floor(random()*ordered.length);
 const angles=n===4?[-3*Math.PI/4]:Array.from({length:24},(_,i)=>i*Math.PI/12);
 const angleOffset=Math.floor(random()*angles.length);
 const radii=n===4?[160*Math.SQRT2,210,190,170]:n===3?[195,180,165,150]:n===2?[200,185,170,150]:[0,180,150];
 for(const radius of radii)for(let a=0;a<angles.length;a++){
  const rotation=angles[(a+angleOffset)%angles.length];
  for(let k=0;k<ordered.length;k++){
   const assignment=ordered[(k+offset)%ordered.length],slots=empty(),centers=empty(),points=empty();
   let valid=true;
   for(const [i,owner] of active.entries()){
    const slot=assignment[i],angle=rotation+2*Math.PI*slot/n,base={x:360+radius*Math.cos(angle),y:260+radius*Math.sin(angle)};
    const squad=players[owner].squad,gap=Math.max(33,...squad.map(c=>radiusOf(c)*2+5));
    // Center one-, two-, and three-fighter formations on the same point.
    // Align the row tangentially so each team starts at the same radial depth.
    const positions=squad.map((chassis,j)=>{
     const shift=(j-(squad.length-1)/2)*gap;
     return {x:base.x-Math.sin(angle)*shift,y:base.y+Math.cos(angle)*shift};
    });
    for(const [j,p] of positions.entries()){
     const probe={...p,type:squad[j].type,chassis:squad[j]};
     bound(probe,arena);
     if(Math.hypot(probe.x-p.x,probe.y-p.y)>1e-7){valid=false;break;}
    }
    if(!valid)break;
    slots[owner]=slot;centers[owner]=base;points[owner]=positions;
   }
   if(valid)return {slots,centers,points};
  }
 }
 // Current arenas always admit a regular formation. A future arena must
 // provide enough clear space rather than silently shifting one team.
 throw Error('Arena cannot accommodate symmetric starting formation');
}
export function spawn(players,arena=ARENAS[0],seed=1,round=1,previousSlots=null){const random=rng(seed),formation=spawnFormation(players,arena,seed+round*37,previousSlots),slots=formation.slots;return {phase:'fight',time:0,tick:0,events:[],visualEvents:[],arena,spawnSlots:slots.slice(),units:players.flatMap((p,i)=>p.hp<=0?[]:p.squad.map((chassis,j)=>{const type=chassis.type,point=formation.points[i][j],u={id:i*100+j,owner:i,type,chassis,squadSize:p.squad.length,livingAllies:p.squad.length-1,x:point.x,y:point.y,cd:random()*.25,motion:[],effects:{},lastAttacked:null,lastAttackAt:-100,retaliationReady:0,effectActivations:{},disengageUntil:0,followthroughAt:0,followthroughCommit:null,focus:null,tauntedBy:null,tauntedUntil:0,facing:0,attack:null,mobilityCd:{},reactionCd:{},stateTime:0,hasteUntil:0,focusUntil:0,bulwarkUntil:0,combatStats:{damage:0,damageTaken:0,moduleDamage:{},moduleHits:{},attacks:0,shots:0,hits:0,wallHits:0,interceptions:0,dodges:0,evaded:0,prevented:0,haste:0,focus:0,bulwark:0},evadingUntil:0,phasingUntil:0,hp:1,maxHp:1,attacker:null};const st=stats(u);u.hp=u.maxHp=st.hp;bound(u,arena);return u})),players,eliminations:[],damageDealt:players.map(()=>0),zones:[],projectiles:[],nextProjectileId:1,nextAttackId:1,random}}

export function placementGroups(state){const active=state.players.map((p,i)=>p.hp>0?i:-1).filter(i=>i>=0);const alive=active.filter(i=>state.units.some(u=>u.owner===i&&u.hp>0));const dead=active.filter(i=>!alive.includes(i));const groups=[];const survivors=[...alive].sort((a,b)=>teamPercent(state,b)-teamPercent(state,a));for(const i of survivors){const score=teamPercent(state,i),last=groups.at(-1);if(last&&last[0].survivor&&Math.abs(last[0].score-score)<1e-9)last.push({owner:i,score,survivor:true});else groups.push([{owner:i,score,survivor:true}])}
 const deathTicks=new Map(state.eliminations.map(e=>[e.owner,e.tick]));dead.sort((a,b)=>(deathTicks.get(b)||0)-(deathTicks.get(a)||0));for(const i of dead){const score=deathTicks.get(i)||0,last=groups.at(-1);if(last&&!last[0].survivor&&last[0].score===score)last.push({owner:i,score,survivor:false});else groups.push([{owner:i,score,survivor:false}])}return groups.map(g=>g.map(x=>x.owner))}
export function placementDamage(round,place,activeCount,streak){if(place===1)return 0;const base=3+(place-2)*3;return Math.round(base*(1+Math.max(0,round-1)*.35)*(1+Math.max(0,streak)*.15))}
export function resolvePlayerHP(players,ranking,round){const bottom=Math.floor(ranking.length/2);for(let place=1;place<=ranking.length;place++){const p=players[ranking[place-1]];const losing=place>ranking.length-bottom;p.streak=losing?(p.streak||0)+1:0;p.hp=Math.max(0,p.hp-placementDamage(round,place,ranking.length,losing?p.streak-1:0))}return players}
