import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,COOPERATIVE_KEYS,TARGET_MODULES,rankRound} from '../src/headless.js';
import {CHASSIS,ARENAS,STEP,makeChassis,spawn,tick,teamPercent,rng} from '../src/simulation.js';
const types=Object.keys(CHASSIS),all=catalog.filter(c=>c.kind!=='unit');
const oldTargetPool=all.filter(c=>c.kind==='target');oldTargetPool.splice(oldTargetPool.findIndex(c=>c.key==='opportunist'),0,{kind:'target',key:'independent'});
const seeds=[4200,4201,4202,4203,4204,4205,4206,4207];
const contexts=[{name:'solo',size:1,background:false},{name:'team',size:2,background:true}];
const baseline=new Map();
function equip(ch,c,stacks){if(c.kind==='attack'||c.kind==='morphology')ch.mods[c.key]=(ch.mods[c.key]||0)+stacks;
 else if(c.kind==='target')for(const [k,v] of Object.entries(TARGET_MODULES[c.key]||{independent:1}))ch.weights[k]+=v*stacks;
 else {if(!ch.passives.includes(c.key))ch.passives.push(c.key);if(c.kind==='utility')ch.mods[c.key]=stacks;}}
function run(card,stacks,ctx,type,seed,enabled){
 const seat=seed%4,random=rng(seed*101+types.indexOf(type)*17);
 const players=Array.from({length:4},(_,i)=>({name:'P'+i,hp:100,squad:Array.from({length:ctx.size},(_,j)=>makeChassis(i===seat&&j===0?type:types[Math.floor(random()*types.length)]))}));
 // Keep the focal build clean; varied teammate and opponent builds cannot duplicate its test module.
 if(ctx.background)for(let i=0;i<4;i++)for(let j=0;j<ctx.size;j++){if(i===seat&&j===0)continue;const ch=players[i].squad[j];
  for(const kind of ['attack','target']){const pool=kind==='target'?oldTargetPool:all.filter(c=>c.kind===kind);equip(ch,pool[Math.floor(random()*pool.length)],1);}
  const pool=all.filter(c=>c.kind==='utility'||c.kind==='passive');equip(ch,pool[Math.floor(random()*pool.length)],1);
 }
 if(enabled)equip(players[seat].squad[0],card,stacks);
 const round=1+seed%ARENAS.length,b=spawn(players,ARENAS[round-1],seed,round);
 for(let i=0;i<900;i++)if(tick(b,STEP)!==null)break;
 const ranking=rankRound({players,seed,round},b),u=b.units.find(x=>x.id===seat*100);
 return {win:Number(ranking[0]===seat),placement:ranking.indexOf(seat)+1,hp:teamPercent(b,seat),damage:b.damageDealt[seat],fighterDamage:u.combatStats.damage,timeout:Number(b.time>=30-1e-6),signature:JSON.stringify(b.units.map(x=>[x.id,x.hp,x.x,x.y]))};
}
const empty=()=>({n:0,cw:0,ew:0,p:0,h:0,d:0,f:0,t:0,up:0,down:0,same:0});
function add(r,c,e){r.n++;r.cw+=c.win;r.ew+=e.win;r.p+=c.placement-e.placement;r.h+=e.hp-c.hp;r.d+=e.damage-c.damage;r.f+=e.fighterDamage-c.fighterDamage;r.t+=e.timeout-c.timeout;r.up+=Number(e.placement<c.placement);r.down+=Number(e.placement>c.placement);r.same+=Number(e.signature===c.signature);}
function audit(card,stacks){
 const total=empty(),byType=Object.fromEntries(types.map(t=>[t,empty()])),byContext=Object.fromEntries(contexts.map(c=>[c.name,empty()]));
 for(const ctx of contexts){if(ctx.size===1&&COOPERATIVE_KEYS.has(card.key))continue;
  for(const type of types)for(const seed of seeds){const key=[ctx.name,type,seed].join('/');
   if(!baseline.has(key))baseline.set(key,run(card,stacks,ctx,type,seed,false));
   const c=baseline.get(key),e=run(card,stacks,ctx,type,seed,true);
   assert.ok(Number.isFinite(e.hp)&&Number.isFinite(e.damage)&&Number.isFinite(e.placement)&&e.placement>0);
   for(const r of [total,byType[type],byContext[ctx.name]])add(r,c,e);
  }
 }
 return {key:card.key,kind:card.kind,stacks,...total,types:byType,contexts:byContext};
}
test('expanded module viability audit',()=>{
 const cards=all.filter(c=>["bulwark","retaliation","inspiration","coordinated"].includes(c.key));
 console.log('AUDIT_CONFIG '+JSON.stringify({seeds,contexts,shard:2,shards:3,cards:cards.map(c=>c.key)}));
 let n=0;
 for(const c of cards){for(const stacks of (c.key==='followthrough'||c.key==='chain'?[1,2,3]:[1])){
  const r=audit(c,stacks);n+=r.n;console.log('AUDIT_ROW '+JSON.stringify(r));
 }}
 console.log('AUDIT_DONE '+JSON.stringify({comparisons:n,controlExecutions:baseline.size}));
});
