import test from 'node:test';
import assert from 'node:assert/strict';
import {makeChassis,spawn,ARENAS,applyRicochetSlide,tick,STEP} from '../src/simulation.js';

function fixture({offset=0,stacks=1,resolve=0,arena=ARENAS[0]}={}){
 const a=makeChassis('bruiser'),b=makeChassis('rogue');
 a.mods.ricochet=stacks;b.mods.resolve=resolve;
 const state=spawn([{hp:100,squad:[a]},{hp:100,squad:[b]}],arena,42,1);
 const [source,target]=state.units;
 Object.assign(source,{x:200,y:200,cd:100});
 Object.assign(target,{x:250,y:200+offset,cd:100});
 state.moduleTelemetry={};state.time=2;
 const hit={source,target,damage:10,attackDirection:0,attackOrigin:{x:200,y:200}};
 return {state,source,target,hit};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
test('Melee Ricochet respects footprint side, stacks, cap, Resolve and combined Knockback',()=>{
 for(const [offset,stacks,knockback,resolve,x,y] of [
 [10,1,0,0,250,226],[-10,1,0,0,250,174],[0,2,2,0,258,232],[0,9,0,0,250,264],[0,1,0,1,250,203.2]]){
  const {state,target,hit}=fixture({offset,stacks,resolve});
  assert.equal(applyRicochetSlide(state,{...hit,knockback}),true);
  near(target.x,x);near(target.y,y);
  assert.equal(target.ricochetStunUntil,undefined);
 }
});
test('Arena collision applies a one second status and five second immunity shared across sources',()=>{
 const {state,source,target,hit}=fixture();
 Object.assign(source,{y:470});Object.assign(target,{y:482});hit.attackOrigin.y=470;
 const hp=target.hp;
 applyRicochetSlide(state,hit);
 assert.equal(target.ricochetStunUntil,3);assert.equal(target.ricochetImmuneUntil,7);
 assert.ok(target.y<=486);assert.equal(target.hp,hp);
 const position={x:target.x,y:target.y};tick(state,STEP);
 near(target.x,position.x);near(target.y,position.y);
 state.time=3;const other={...source,id:999};
 applyRicochetSlide(state,{...hit,source:other});
 assert.equal(target.ricochetStunUntil,3);
 assert.equal(state.moduleTelemetry[other.id].ricochet.immuneCollisions,1);
 state.time=7;applyRicochetSlide(state,hit);
 assert.equal(target.ricochetStunUntil,8);
 assert.equal(state.moduleTelemetry[source.id].ricochet.collisionStuns,2);
});
test('Terrain and occupied space stop the slide without extra damage',()=>{
 for(const terrain of [true,false]){
  const {state,source,target,hit}=fixture({stacks:4,arena:terrain?{name:'Test',obstacles:[{x:230,y:245,w:40,h:20}]}:ARENAS[0]});
  if(!terrain){const other={...source,id:999,x:250,y:250};state.units.push(other);}
  const hp=target.hp;applyRicochetSlide(state,hit);
  assert.ok(target.y<245);assert.equal(target.ricochetStunUntil,3);assert.equal(target.hp,hp);
 }
});
test('Projectile, indirect, and secondary events do not trigger melee movement',()=>{
 for(const flag of ['projectile','indirect','secondary']){
  const {state,target,hit}=fixture();
  assert.equal(applyRicochetSlide(state,{...hit,[flag]:true}),false);
  near(target.y,200);
 }
});
