import test from 'node:test';
import assert from 'node:assert/strict';
import {ARENAS,makeChassis,stats,spawnSlots} from '../src/simulation.js';
import {PROFILES,applyProfile,focalSeats,makeFixture,pairedSummary,runFixture} from '../scripts/fighter-personalities.js';

test('personality profiles alter only intended weights; card doses use registry',()=>{
 const base=makeChassis('ranged');
 for(const profile of PROFILES){
  const c=applyProfile(makeChassis('ranged'),profile);
  assert.deepEqual(c.mods,base.mods);
  assert.deepEqual(c.passives,base.passives);
  assert.deepEqual(c.modules,base.modules);
  const changed=Object.keys(c.weights).filter(k=>c.weights[k]!==base.weights[k]);
  assert.equal(changed.length,profile.name==='baseline'?0:1);
  if(changed.length){
   const k=changed[0];assert.equal(c.weights[k],profile.zero?0:base.weights[k]+profile.n);
  }
 }
});
test('matched fixtures preserve seats, initial stats, health and other units',()=>{
 const spec={seed:5,arena:ARENAS[0],type:'rogue',owner:2,health:.3,condition:'control'};
 const a=makeFixture({...spec,profile:PROFILES[0]});
 const b=makeFixture({...spec,profile:PROFILES.find(p=>p.name==='safety+3')});
 assert.deepEqual(a.b.spawnSlots,b.b.spawnSlots);
 assert.deepEqual(stats(a.focal),stats(b.focal));
 assert.equal(a.focal.hp,b.focal.hp);
 assert.ok(a.focal.hp/a.focal.maxHp<.35);
 assert.deepEqual(a.b.units.filter(u=>u.id!==a.focal.id),b.b.units.filter(u=>u.id!==b.focal.id));
 assert.deepEqual({...a.focal,chassis:null},{...b.focal,chassis:null});
 for(let seed=5;seed<=8;seed++){
  const slots=spawnSlots(seed+37),[x,y]=focalSeats(seed);
  assert.equal((slots[x]+2)%4,slots[y]);
 }
});
test('paired summary excludes undefined denominators and reports directional counts',()=>{
 const rows=[{profile:'x',result:{a:2,b:null},baseline:{a:1,b:2}},{profile:'x',result:{a:0,b:1},baseline:{a:1,b:1}}];
 const p=pairedSummary(rows).x;
 assert.equal(p.pairs,2);assert.deepEqual(p.metrics.a,{n:2,base:1,value:1,delta:0,up:1,down:1,tie:0});
 assert.equal(p.metrics.b.n,1);assert.equal(p.metrics.b.tie,1);
});
test('a fixed fixture is repeatable with the same preference and engine arm',()=>{
 const spec={seed:5,arena:ARENAS[0],type:'ranged',owner:0,health:1,condition:'position-engagement-mid',profile:PROFILES[0]};
 assert.deepEqual(runFixture(spec),runFixture(spec));
});
