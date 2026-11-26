import test from 'node:test';
import assert from 'node:assert/strict';
import {makeChassis,spawn,ARENAS,stats,startAttack,advanceAttack,advanceProjectiles} from '../src/simulation.js';
function fixture({stacks=1,range=0,chain=0,hazardous=0,projectiles=0}={}){
 const a=makeChassis('ranged'),b=makeChassis('rogue');
 Object.assign(a.mods,{ricochet:stacks,range,chain,hazardous,projectiles});
 const state=spawn([{hp:100,squad:[a]},{hp:100,squad:[b]}],ARENAS[0],42,1);
 const [source,target]=state.units;
 Object.assign(source,{x:80,y:200,cd:0});Object.assign(target,{x:40,y:200});
 state.moduleTelemetry={};
 startAttack(state,source,target);advanceAttack(state,source,target,stats(source),1,[]);
 target.x=600;target.y=400;
 return {state,source,target};
}
test('Ranged Ricochet renews original upgraded travel distance and preserves speed',()=>{
 const {state,source}=fixture({stacks:2,range:3});
 const shot=state.projectiles[0],speed=shot.speed,raw=shot.damage;
 advanceProjectiles(state,60/speed,[]);
 assert.equal(shot.bounces,1);assert.equal(shot.vx,1);
 assert.ok(Math.abs(shot.remaining-stats(source).range)<.002);
 assert.equal(shot.speed,speed);assert.equal(shot.damage,raw);
 assert.equal(state.moduleTelemetry[source.id].ricochet.bounces,1);
 advanceProjectiles(state,1,[]);
 assert.equal(state.projectiles.length,0);
});
test('Ranged bounce effects are bounded per volley and Chain adds auxiliary value',()=>{
 const {state,source,target}=fixture({stacks:8,chain:1,hazardous:1,projectiles:2});
 target.x=70;target.y=250;
 const shot=state.projectiles[0],raw=shot.damage,attacks=[];
 assert.equal(shot.bounces,2);
 advanceProjectiles(state,.35,attacks);
 const m=state.moduleTelemetry[source.id].ricochet;
 assert.equal(m.hazardActivations,1);assert.equal(m.chainActivations,1);
 assert.equal(state.zones.length,1);
 assert.equal(attacks.filter(a=>a.secondary).length,1);
 assert.equal(shot.damage,raw);assert.ok(Math.abs(attacks.find(a=>a.secondary).rawDamage-raw*.15)<1e-8);
 assert.ok(shot.volley.hitIds.has(target.id));
 assert.equal(attacks.filter(a=>!a.secondary&&a.target===target).length,0);
});
test('Ordinary projectiles still expire at their original range or wall',()=>{
 const {state}=fixture({stacks:0});
 advanceProjectiles(state,1,[]);
 assert.equal(state.projectiles.length,0);
});
