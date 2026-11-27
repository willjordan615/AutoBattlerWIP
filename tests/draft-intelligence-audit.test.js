import test from 'node:test';
import assert from 'node:assert/strict';
import {allocations,startingTypes,profileProbe,runMatch} from '../scripts/draft-intelligence-audit.js';
test('mixed crossover allocates each policy once to every seat and uses same starts',()=>{
 for(const seed of [4101,4102,4103,4104]){
  const [a,b,c,d]=allocations(seed);
  for(let i=0;i<4;i++)assert.notEqual(a.policies[i],b.policies[i]);
  assert.equal(a.policies.filter(x=>x==='candidate').length,2);assert.equal(b.policies.filter(x=>x==='candidate').length,2);
  assert.ok(c.policies.every(x=>x==='legacy')&&d.policies.every(x=>x==='candidate'));
  assert.equal(new Set(startingTypes(seed)).size,3);
 }
});
test('profile probes have identical coverage and remain deterministic',()=>{
 const a=profileProbe(4101,1),b=profileProbe(4101,1);
 assert.deepEqual(a,b);assert.equal(a.legacy.fixtures,9);assert.equal(a.candidate.traitComparisons,54);
});
test('mixed real draft completes with one winner and recorded picks',()=>{
 const a=runMatch(4101,allocations(4101)[0]);
 assert.equal(a.seats.filter(s=>s.won).length,1);
 assert.deepEqual(a.seats.map(s=>s.rank).sort(),[1,2,3,4]);
 assert.ok(a.rounds.length>0);assert.ok(a.seats.every(s=>s.picks.length>0));
});
