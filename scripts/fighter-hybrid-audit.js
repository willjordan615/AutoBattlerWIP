// Controlled hybrid-card value audit; no production draft or stat changes.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {ARENAS} from '../src/simulation.js';
import {TYPES,focalSeats,runFixture,pairedSummary} from './fighter-personalities.js';

export const HYBRIDS=Object.freeze({
 aggressor:{stat:'damage',fraction:.5,label:'+1 damage'},
 duelist:{stat:'speed',fraction:.25,label:'+4.5 speed'},
 guardian:{stat:'hp',fraction:.5,label:'+10 HP'}
});
export const ARMS=['threat-position','position-engagement-mid'];
export function variants(card,n){
 const h=HYBRIDS[card];assert.ok(h&&[1,3].includes(n));
 const stat=(fraction)=>({[h.stat]:fraction*n});
 return [
  {name:'baseline'},
  {name:'weight',card,n},
  {name:'small-stat',statMods:stat(h.fraction)},
  {name:'hybrid',card,n,statMods:stat(h.fraction)},
  {name:'full-stat',statMods:stat(1)}
 ];
}
// All contrasts use the same original fixture. Hybrid-minus-small-stat tests
// weight value after the bonus; hybrid-minus-weight tests the bonus's value.
export function comparisons(results){
 return [
  ['weight-v-base','weight','baseline'],
  ['small-stat-v-base','small-stat','baseline'],
  ['hybrid-v-base','hybrid','baseline'],
  ['full-stat-v-base','full-stat','baseline'],
  ['hybrid-v-weight','hybrid','weight'],
  ['hybrid-v-small-stat','hybrid','small-stat'],
  ['hybrid-v-full-stat','hybrid','full-stat']
 ].map(([profile,a,b])=>({profile,result:results[a],baseline:results[b]}));
}
export function runHybrid({condition,type,card,start=9,count=2}){
 assert.ok(ARMS.includes(condition)&&TYPES.includes(type)&&HYBRIDS[card]);
 assert.ok(Number.isInteger(start)&&Number.isInteger(count)&&count>0&&count<=20);
 const rows=[];let rounds=0;
 for(let seed=start;seed<start+count;seed++)for(const arena of ARENAS)for(const owner of focalSeats(seed))for(const layout of ['mirror','mixed']){
  const spec={seed,arena,type,owner,health:1,condition,layout};
  const baseline=runFixture({...spec,profile:{name:'baseline'}});rounds++;
  for(const n of [1,3]){
   const results={baseline};
   for(const profile of variants(card,n).slice(1)){
    results[profile.name]=runFixture({...spec,profile});rounds++;
   }
   rows.push({seed,arena:arena.name,owner,layout,n,results});
  }
 }
 const summary={condition,type,card,start,count,rounds,fixtureStrata:rows.length/2,groups:{}};
 for(const n of [1,3])for(const layout of ['all','mirror','mixed']){
  const subset=rows.filter(r=>r.n===n&&(layout==='all'||r.layout===layout));
  summary.groups[n+':'+layout]=pairedSummary(subset.flatMap(r=>comparisons(r.results)));
 }
 return {summary,rows};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=runHybrid({condition:process.argv[2],type:process.argv[3],card:process.argv[4],start:Number(process.argv[5]||9),count:Number(process.argv[6]||2)});
 console.log(JSON.stringify(report));
}
