import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {moduleCases} from './final-audit-modules.js';
const records=readdirSync('audit-results').filter(x=>x.endsWith('.json')).map(x=>JSON.parse(readFileSync('audit-results/'+x,'utf8')));
const expected={modules:12,synergy:8,stress:8,cross:4,matches:8};
const seen=new Set();
for(const r of records){const key=r.kind+':'+r.shard;assert.ok(Object.hasOwn(expected,r.kind)&&Number.isInteger(r.shard)&&r.shard>=0&&r.shard<expected[r.kind]&&!seen.has(key),key);seen.add(key);}
assert.equal(seen.size,Object.values(expected).reduce((a,b)=>a+b,0));
const select=kind=>records.filter(r=>r.kind===kind).sort((a,b)=>a.shard-b.shard);
const modules=select('modules').flatMap(r=>r.rows);
const keys=new Map(moduleCases().map(c=>[c.card.key+':'+c.stacks,c.n]));
for(const r of modules){const key=r.key+':'+r.stacks;assert.equal(r.n,keys.get(key),key);keys.delete(key);}
assert.equal(keys.size,0);
const builds=select('synergy').flatMap(r=>r.rows),stress=select('stress').flatMap(r=>r.rows);
for(const [rows,variants,count] of [[builds,['bare','core','other','full','random2','random4'],3456],[stress,['stressfull','stressrandom','stressdistributed'],1728]]){
 assert.equal(rows.reduce((s,r)=>s+r.n,0),count);
 const cases=new Set(rows.map(r=>r.build+':'+r.size+':'+r.variant));assert.equal(cases.size,rows.length);assert.equal(new Set(rows.map(r=>r.build)).size,8);
 for(const r of rows)assert.ok(r.n===36&&[2,3].includes(r.size)&&variants.includes(r.variant));
}
const cross=select('cross').flatMap(r=>r.rows);assert.equal(cross.length,1440);assert.equal(new Set(cross.map(r=>r.seed+':'+r.rot)).size,1440);
const tournament={};
for(const r of cross)for(const [i,name] of r.ranking.entries()){const b=tournament[name]||={n:0,wins:0,placement:0,timeout:0};b.n++;b.wins+=Number(i===0);b.placement+=i+1;b.timeout+=r.timeout;}
for(const b of Object.values(tournament))assert.equal(b.n,720);
const matches=select('matches').map(r=>r.report);
for(const mode of ['random','strategic'])assert.equal(matches.filter(r=>r.config.mode===mode).reduce((s,r)=>s+r.completed,0),300);
const counts={comparisons:modules.reduce((s,r)=>s+r.n,0),controlExecutions:select('modules').reduce((s,r)=>s+r.controlExecutions,0),synergy:3456,stress:1728,cross:1440,matches:600,matchRounds:matches.reduce((s,r)=>s+r.combat.battles,0)};
const summary={counts,modules,builds,stress,tournament,crossTimeouts:cross.reduce((s,r)=>s+r.timeout,0),crossStalls:cross.reduce((s,r)=>s+r.stalls,0),matches};
writeFileSync('audit-summary.json',JSON.stringify(summary,null,2));
console.log('AUDIT_COUNTS '+JSON.stringify(counts));
for(const r of modules)console.log('MODULE '+JSON.stringify({key:r.key,stacks:r.stacks,n:r.n,winDeltaPP:100*(r.ew-r.cw)/r.n,placementDelta:r.p/r.n,unchanged:r.same/r.n,measured:r.measured/r.n}));
for(const r of [...builds,...stress])console.log('BUILD '+JSON.stringify({build:r.build,size:r.size,variant:r.variant,n:r.n,wins:r.win,place:r.place/r.n,timeouts:r.timeout,stalls:r.stalls}));
console.log('TOURNAMENT '+JSON.stringify(tournament));
for(const r of matches)console.log('MATCH '+JSON.stringify({config:r.config,completed:r.completed,combat:r.combat,startingChassis:r.startingChassis,flags:r.flags}));
