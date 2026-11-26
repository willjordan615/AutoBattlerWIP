import test from 'node:test';
import assert from 'node:assert/strict';
import {ARENAS,makeChassis,stats} from '../src/simulation.js';
import {applyProfile,makeFixture} from '../scripts/fighter-personalities.js';
import {HYBRIDS,variants,comparisons} from '../scripts/fighter-hybrid-audit.js';

test('hybrid bonuses are strictly diagnostic, additive and distinct from weights',()=>{
 for(const [card,h] of Object.entries(HYBRIDS))for(const n of [1,3]){
  const profiles=variants(card,n);
  const c=Object.fromEntries(profiles.map(p=>[p.name,applyProfile(makeChassis('rogue'),p)]));
  assert.deepEqual(c.hybrid.weights,c.weight.weights);
  assert.deepEqual(c.hybrid.mods,c['small-stat'].mods);
  assert.deepEqual(c['full-stat'].weights,c.baseline.weights);
  assert.equal(c.hybrid.mods[h.stat],h.fraction*n);
  assert.equal(c['full-stat'].mods[h.stat],n);
  assert.deepEqual(c.hybrid.modules,c.baseline.modules);
 }
});
test('mixed fixtures retain all other units and seed when focal profile changes',()=>{
 const spec={seed:9,arena:ARENAS[1],type:'ranged',owner:1,health:1,condition:'threat-position',layout:'mixed'};
 const a=makeFixture({...spec,profile:{name:'baseline'}}),b=makeFixture({...spec,profile:variants('guardian',1).find(p=>p.name==='hybrid')});
 assert.deepEqual(a.b.spawnSlots,b.b.spawnSlots);
 assert.deepEqual(a.b.units.filter(u=>u.id!==a.focal.id),b.b.units.filter(u=>u.id!==b.focal.id));
 assert.deepEqual(a.b.players.map(p=>p.squad.length),[2,2,1,3]);
 assert.equal(stats(b.focal).hp-stats(a.focal).hp,10);
 assert.equal(b.focal.x,a.focal.x);
 assert.equal(b.focal.y,a.focal.y);
});
test('paired contrasts keep matched stat-only and weight-only references',()=>{
 const r={baseline:{rank:4},weight:{rank:3},'small-stat':{rank:2},hybrid:{rank:1},'full-stat':{rank:2}};
 const c=comparisons(r);assert.equal(c.length,7);
 assert.deepEqual(c.find(x=>x.profile==='hybrid-v-small-stat'),{profile:'hybrid-v-small-stat',result:r.hybrid,baseline:r['small-stat']});
});
