import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog,COOPERATIVE_KEYS} from '../src/headless.js';
import {CHASSIS} from '../src/simulation.js';
import {moduleTrial} from '../scripts/module-comparison.js';
const types=Object.keys(CHASSIS),cards=catalog.filter(c=>c.kind!=='unit'),seeds=[3101,3102,3103];
const contexts=[{size:1,teams:4,background:false},{size:2,teams:4,background:true}];
const baseline=new Map();
const run=(card,stacks,context,type,seed,enabled)=>moduleTrial({seed,type,card,stacks,...context,enabled,telemetry:false});
const empty=()=>({n:0,w:0,p:0,h:0,d:0,f:0,t:0,up:0,down:0});
const accumulate=(row,c,e)=>{row.n++;row.w+=e.win-c.win;row.p+=c.placement-e.placement;row.h+=e.hp-c.hp;row.d+=e.damage-c.damage;row.f+=e.fighterDamage-c.fighterDamage;row.t+=e.timeout-c.timeout;row.up+=Number(e.placement<c.placement);row.down+=Number(e.placement>c.placement)};
const summarize=r=>({n:r.n,winPP:+(100*r.w/r.n).toFixed(1),place:+(r.p/r.n).toFixed(3),hpPP:+(100*r.h/r.n).toFixed(1),damage:+(r.d/r.n).toFixed(1),fighterDamage:+(r.f/r.n).toFixed(1),timeoutPP:+(100*r.t/r.n).toFixed(1),up:r.up,down:r.down});
function audit(card,stacks){
 const total=empty(),byType=Object.fromEntries(types.map(t=>[t,empty()]));
 for(const context of contexts){if(context.size===1&&COOPERATIVE_KEYS.has(card.key))continue;
  for(const type of types)for(const seed of seeds){
   const key=[context.size,type,seed].join('/');
   if(!baseline.has(key))baseline.set(key,run(card,stacks,context,type,seed,false));
   const c=baseline.get(key),e=run(card,stacks,context,type,seed,true);
   assert.ok(Number.isFinite(e.hp)&&Number.isFinite(e.damage)&&Number.isFinite(e.placement));
   accumulate(total,c,e);accumulate(byType[type],c,e);
  }
 }
 return {key:card.key,kind:card.kind,stacks,...summarize(total),types:Object.fromEntries(types.map(t=>[t,summarize(byType[t])]))};
}
test('module viability audit: all draft modules, controlled rounds',()=>{
 console.log('AUDIT_CONFIG '+JSON.stringify({seeds,contexts,types,modules:cards.length}));
 let n=0;for(const card of cards){const row=audit(card,1);n+=row.n;console.log('AUDIT_ROW '+JSON.stringify(row));}
 for(const card of cards.filter(c=>['growth','shrink','followthrough'].includes(c.key)))for(const stacks of [2,3]){const row=audit(card,stacks);n+=row.n;console.log('AUDIT_ROW '+JSON.stringify(row));}
 console.log('AUDIT_DONE '+JSON.stringify({comparisons:n,controlExecutions:baseline.size,experimentExecutions:n}));
});
