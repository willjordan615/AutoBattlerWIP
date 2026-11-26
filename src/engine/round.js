// Engine subsystem: round. See AGENTS.md for ownership and test routes.
import {rng,stats} from './stats.js?v=engine-330-r1';
import {ARENAS,radiusOf} from './config.js?v=engine-330-r1';
import {bound} from './geometry.js?v=engine-330-r1';

export function teamPercent(state,owner){const team=state.units.filter(u=>u.owner===owner);const max=team.reduce((n,u)=>n+u.maxHp,0);return max?team.reduce((n,u)=>n+Math.max(0,u.hp),0)/max:0}
// Randomize the *owner-to-corner assignment*, not just the arena orientation.
// When a prior assignment is supplied, no player repeats their previous corner.
export function spawnSlots(seed,previousSlots=null){
 const random=rng(seed),permutations=[];
 for(let a=0;a<4;a++)for(let b=0;b<4;b++)if(b!==a)for(let c=0;c<4;c++)if(c!==a&&c!==b)for(let d=0;d<4;d++)if(d!==a&&d!==b&&d!==c)permutations.push([a,b,c,d]);
 const eligible=previousSlots?.length===4?permutations.filter(p=>p.every((slot,i)=>slot!==previousSlots[i])):permutations;
 return eligible[Math.floor(random()*eligible.length)].slice()
}
export function spawn(players,arena=ARENAS[0],seed=1,round=1,previousSlots=null){const starts=[[110,100],[610,100],[610,420],[110,420]],random=rng(seed),slots=spawnSlots(seed+round*37,previousSlots);return {phase:'fight',time:0,tick:0,events:[],visualEvents:[],arena,spawnSlots:slots.slice(),units:players.flatMap((p,i)=>p.hp<=0?[]:p.squad.map((chassis,j)=>{const type=chassis.type,base=starts[slots[i%4]],gap=Math.max(33,...p.squad.map(c=>radiusOf(c)*2+5)),u={id:i*100+j,owner:i,type,chassis,squadSize:p.squad.length,x:base[0]+(j%3-1)*gap,y:base[1]+(Math.floor(j/3)-1)*30,cd:random()*.25,motion:[],effects:{},lastAttacked:null,lastAttackAt:-100,retaliationReady:0,effectActivations:{},disengageUntil:0,followthroughAt:0,followthroughCommit:null,focus:null,tauntedBy:null,tauntedUntil:0,facing:0,attack:null,mobilityCd:{},reactionCd:{},stateTime:0,hasteUntil:0,focusUntil:0,bulwarkUntil:0,combatStats:{damage:0,damageTaken:0,moduleDamage:{},moduleHits:{},attacks:0,shots:0,hits:0,wallHits:0,interceptions:0,dodges:0,evaded:0,prevented:0,haste:0,focus:0,bulwark:0},evadingUntil:0,phasingUntil:0,hp:1,maxHp:1,attacker:null};const st=stats(u);u.hp=u.maxHp=st.hp;bound(u,arena);return u})),players,eliminations:[],damageDealt:players.map(()=>0),zones:[],projectiles:[],nextProjectileId:1,nextAttackId:1,random}}

export function placementGroups(state){const active=state.players.map((p,i)=>p.hp>0?i:-1).filter(i=>i>=0);const alive=active.filter(i=>state.units.some(u=>u.owner===i&&u.hp>0));const dead=active.filter(i=>!alive.includes(i));const groups=[];const survivors=[...alive].sort((a,b)=>teamPercent(state,b)-teamPercent(state,a));for(const i of survivors){const score=teamPercent(state,i),last=groups.at(-1);if(last&&last[0].survivor&&Math.abs(last[0].score-score)<1e-9)last.push({owner:i,score,survivor:true});else groups.push([{owner:i,score,survivor:true}])}
 const deathTicks=new Map(state.eliminations.map(e=>[e.owner,e.tick]));dead.sort((a,b)=>(deathTicks.get(b)||0)-(deathTicks.get(a)||0));for(const i of dead){const score=deathTicks.get(i)||0,last=groups.at(-1);if(last&&!last[0].survivor&&last[0].score===score)last.push({owner:i,score,survivor:false});else groups.push([{owner:i,score,survivor:false}])}return groups.map(g=>g.map(x=>x.owner))}
export function placementDamage(round,place,activeCount,streak){if(place===1)return 0;const base=3+(place-2)*3;return Math.round(base*(1+Math.max(0,round-1)*.35)*(1+Math.max(0,streak)*.15))}
export function resolvePlayerHP(players,ranking,round){const bottom=Math.floor(ranking.length/2);for(let place=1;place<=ranking.length;place++){const p=players[ranking[place-1]];const losing=place>ranking.length-bottom;p.streak=losing?(p.streak||0)+1:0;p.hp=Math.max(0,p.hp-placementDamage(round,place,ranking.length,losing?p.streak-1:0))}return players}
