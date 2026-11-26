import assert from 'node:assert/strict';
import {COOPERATIVE_KEYS,rankRound} from '../src/headless.js';
import {ARENAS,STEP,makeChassis,spawn,tick,teamPercent,rng,stats} from '../src/simulation.js';
import {types,cards,equip,randomPicks} from './final-audit-builds.js';
const baseline=new Map();
export function stackOptions(c){return c.kind==='morphology'||c.kind==='passive'||['resolve','coordinated'].includes(c.key)?[1]:c.kind==='utility'?[1,2]:[1,2,3];}
export function moduleSeeds(stacks){return Array.from({length:stacks===1?8:4},(_,i)=>4200+i);}
export function moduleCases(){return cards.flatMap(c=>stackOptions(c).map(stacks=>({card:c,stacks,n:types.length*moduleSeeds(stacks).length*(COOPERATIVE_KEYS.has(c.key)?2:3)})));}
function trial(card,stacks,size,type,seed,enabled){
 const seat=seed%4,random=rng(seed*101+types.indexOf(type)*17+size*113);
 const players=Array.from({length:4},(_,i)=>({name:'P'+i,hp:100,squad:Array.from({length:size},(_,j)=>makeChassis(i===seat&&j===0?type:types[Math.floor(random()*types.length)]))}));
 if(size>1)for(let i=0;i<4;i++)for(let j=0;j<size;j++)if(i!==seat||j!==0)randomPicks(players,i,3,random,[j]);
 if(enabled)for(let j=0;j<stacks;j++)equip(players,seat,0,card.key);
 const round=1+seed%ARENAS.length,b=spawn(players,ARENAS[round-1],seed,round);b.moduleTelemetry={};
 for(let i=0;i<900;i++)if(tick(b,STEP)!==null)break;
 const ranking=rankRound({players,seed,round},b),u=b.units.find(x=>x.id===seat*100);
 for(const x of b.units)assert.ok(Number.isFinite(x.x)&&Number.isFinite(x.y)&&Number.isFinite(x.hp)&&x.hp>=0&&x.hp<=x.maxHp+1e-6&&stats(x).defense<=10,'finite bounded state');
 return {win:Number(ranking[0]===seat),placement:ranking.indexOf(seat)+1,hp:teamPercent(b,seat),damage:b.damageDealt[seat],fighterDamage:u.combatStats.damage,timeout:Number(b.time>=30-1e-6),stalls:b.units.reduce((n,x)=>n+(x.navStuckCount||0),0),signature:JSON.stringify(b.units.map(x=>[x.id,x.hp,x.x,x.y])),metrics:b.moduleTelemetry[u.id]?.[card.key]||{},credited:u.combatStats.moduleDamage[card.key]||0,delivery:u.combatStats.moduleHits[card.key]||0,followthrough:u.combatStats.followthrough||0,bonuses:u.combatStats.followthroughBonus||0};
}
const empty=()=>({n:0,cw:0,ew:0,p:0,h:0,d:0,f:0,t:0,ct:0,et:0,stalls:0,up:0,down:0,same:0,measured:0,credited:0,delivery:0,metrics:{}});
function add(r,c,e,key){r.n++;r.cw+=c.win;r.ew+=e.win;r.p+=c.placement-e.placement;r.h+=e.hp-c.hp;r.d+=e.damage-c.damage;r.f+=e.fighterDamage-c.fighterDamage;r.t+=e.timeout-c.timeout;r.ct+=c.timeout;r.et+=e.timeout;r.stalls+=e.stalls-c.stalls;r.up+=Number(e.placement<c.placement);r.down+=Number(e.placement>c.placement);r.same+=Number(e.signature===c.signature);r.measured+=Number(Object.values(e.metrics).some(v=>v>0)||e.credited>0||e.delivery>0||(key==='followthrough'&&e.followthrough>0));r.credited+=e.credited;r.delivery+=e.delivery;for(const [k,v] of Object.entries(e.metrics))r.metrics[k]=(r.metrics[k]||0)+v;}
export function moduleAudit(shard,shards=12){
 const rows=[];
 for(const [i,{card,stacks,n}] of moduleCases().entries()){
  if(i%shards!==shard)continue;
  const total=empty(),byType=Object.fromEntries(types.map(t=>[t,empty()])),bySize={1:empty(),2:empty(),3:empty()};
  for(const size of [1,2,3]){
   if(size===1&&COOPERATIVE_KEYS.has(card.key))continue;
   for(const type of types)for(const seed of moduleSeeds(stacks)){
    const key=[size,type,seed].join('/');
    if(!baseline.has(key))baseline.set(key,trial(card,stacks,size,type,seed,false));
    const c=baseline.get(key),e=trial(card,stacks,size,type,seed,true);
    for(const r of [total,byType[type],bySize[size]])add(r,c,e,card.key);
   }
  }
  assert.equal(total.n,n);
  rows.push({key:card.key,kind:card.kind,stacks,...total,types:byType,sizes:bySize});
 }
 return {rows,comparisons:rows.reduce((s,r)=>s+r.n,0),controlExecutions:baseline.size};
}
