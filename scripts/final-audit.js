import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {catalog,rankRound} from '../src/headless.js';
import {ARENAS,STEP,makeChassis,spawn,tick,teamPercent,rng,stats} from '../src/simulation.js';
import {runBalance} from './balance-report.js';
import {types,builds,equip,run,aggregate} from './final-audit-builds.js';
import {moduleAudit,moduleCases} from './final-audit-modules.js';
const [kind='modules',shardArg='0']=process.argv.slice(2),shard=Number(shardArg);
assert.ok(Number.isInteger(shard)&&shard>=0);
const sizes=[2,3];
function synergy(stress){
 const build=builds[shard];assert.ok(build);
 const variants=stress?['stressfull','stressrandom','stressdistributed']:['bare','core','other','full','random2','random4'];
 const rows=[];
 for(const size of sizes)for(const variant of variants){
  const a=aggregate(Array.from({length:36},(_,i)=>run(build,7300+i,size,variant)));
  rows.push({build:build.name,size,variant,...a});
 }
 return {rows,rounds:rows.reduce((s,r)=>s+r.n,0)};
}
// A balanced tournament: eight cyclic four-build groups per seed, all builds
// appear four times in each cycle, each in each seat exactly once.
function cross(){
 const rows=[],groups=[[0,1,3,4],[0,2,5,7],[0,3,5,6]];
 // The eight rotations of one pattern cover every build equally.
 for(let s=0;s<45;s++)for(let rot=0;rot<8;rot++){
  const seed=8100+s+45*shard,pattern=groups[(s+shard)%groups.length],indices=pattern.map((x,i)=>(x+rot)%8);
  const players=indices.map((id,i)=>({name:builds[id].name,hp:100,squad:[makeChassis(builds[id].type),makeChassis(types[(seed+i)%3]),makeChassis(types[(seed+i+1)%3])]}));
  for(let i=0;i<4;i++)for(const [j,key] of [...builds[indices[i]].core,...builds[indices[i]].other])equip(players,i,j,key);
  const round=1+seed%ARENAS.length,b=spawn(players,ARENAS[round-1],seed,round);
  for(let t=0;t<900;t++)if(tick(b,STEP)!==null)break;
  const rank=rankRound({players,seed,round},b);
  assert.equal(new Set(rank).size,4);
  for(const u of b.units)assert.ok(Number.isFinite(u.hp)&&Number.isFinite(u.x)&&Number.isFinite(u.y)&&stats(u).defense<=10);
  rows.push({seed,rot,builds:indices.map(id=>builds[id].name),winner:builds[indices[rank[0]]].name,ranking:rank.map(i=>builds[indices[i]].name),timeout:Number(b.time>=30-1e-6),stalls:b.units.reduce((n,u)=>n+(u.navStuckCount||0),0)});
 }
 return {rows,rounds:rows.length};
}
let result;
if(kind==='modules')result=moduleAudit(shard);
else if(kind==='synergy'||kind==='stress')result=synergy(kind==='stress');
else if(kind==='cross')result=cross();
else if(kind==='matches'){
 const mode=shard<4?'random':'strategic',index=shard%4;
 const report=runBalance({matches:75,seed:9000+index*75,mode});
 assert.equal(report.completed,75);result={report};
}else throw Error('Unknown audit type '+kind);
mkdirSync('audit-results',{recursive:true});
const record={kind,shard,...result};
writeFileSync('audit-results/'+kind+'-'+shard+'.json',JSON.stringify(record));
console.log('FINAL_AUDIT '+JSON.stringify(kind==='cross'?{kind,shard,rounds:result.rounds}:record));
