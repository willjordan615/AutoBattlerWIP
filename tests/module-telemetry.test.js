import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../src/headless.js';
import {moduleTrial,compareModules} from '../scripts/module-comparison.js';
test('telemetry does not alter deterministic combat',()=>{const args={seed:3101,type:'rogue',size:2,teams:2,card:catalog.find(c=>c.key==='siphon'),stacks:1,enabled:true};const a=moduleTrial({...args,telemetry:true}),b=moduleTrial({...args,telemetry:false});assert.deepEqual(a.signature,b.signature);assert.equal(a.placement,b.placement);assert.equal(a.damage,b.damage);});
test('paired report stratifies trials and records measured effects',()=>{const r=compareModules({keys:['velocity'],seeds:1,sizes:[1],teams:[2],stackCounts:[1],backgrounds:[false]});assert.equal(r.pairedRounds,3);assert.equal(r.rows.length,3);for(const row of r.rows){assert.equal(row.improved+row.worse+row.unchanged,1);assert.ok(row.metrics.releases>0);}});

import {spawn,tick,STEP,ARENAS,makeChassis,CHASSIS,stats,resolveAttackModules} from '../src/simulation.js';
test('Inspiration grants 35% extra utility cooldown recovery only to nearby allies',()=>{
 const run=({enabled=true,far=false,telemetry=true,short=false}={})=>{
  const a=makeChassis('bruiser'),b=makeChassis('rogue');
  if(enabled)a.passives.push('inspiration');
  const battle=spawn([{hp:100,squad:[a,b]},{hp:100,squad:[makeChassis('ranged')]}],ARENAS[0],42,1);
  const [u,v,e]=battle.units;
  Object.assign(u,{x:120,y:120});
  Object.assign(v,{x:far?300:160,y:120});
  Object.assign(e,{x:610,y:420});
  v.mobilityCd.dash=short?STEP*1.1:10;
  v.reactionCd.focus=u.mobilityCd.dash=e.mobilityCd.dash=10;
  if(telemetry)battle.moduleTelemetry={};
  tick(battle,STEP);
  return {time:battle.time,allyMobility:v.mobilityCd.dash,allyReaction:v.reactionCd.focus,
   self:u.mobilityCd.dash,enemy:e.mobilityCd.dash,
   measured:battle.moduleTelemetry?.[u.id]?.inspiration?.cooldownSecondsSaved||0,
   signature:battle.units.map(u=>[u.id,u.hp,u.x,u.y,u.mobilityCd,u.reactionCd])};
 };
 const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9);
 const result=run();
 near(result.allyMobility,10-STEP*.35);
 near(result.allyReaction,10-STEP*.35);
 near(result.measured,2*STEP*.35);
 assert.equal(result.self,10);
 assert.equal(result.enemy,10);
 assert.equal(run({far:true}).allyMobility,10);
 assert.equal(run({enabled:false}).allyMobility,10);
 assert.deepEqual(result.signature,run({telemetry:false}).signature);
 const short=run({short:true});
 near(short.allyMobility,short.time);
});

test('Resolve gives fixed resistance and additive defense at every health level',()=>{
 const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8);
 for(const type of Object.keys(CHASSIS))for(const n of [0,1,3]){
  const ch=makeChassis(type);ch.mods.resolve=n;
  const u={type,chassis:ch,hp:100,maxHp:100,stateTime:1,effects:{slowUntil:2,slowStrength:.45}};
  const expected=CHASSIS[type].speed*(1-.45*(n?.2:1));
  near(stats(u).speed,expected);
  u.hp=1;
  near(stats(u).speed,expected);
  near(stats(u).defense,CHASSIS[type].defense+n);
  u.effects.slowUntil=1;
  near(stats(u).speed,CHASSIS[type].speed);
 }
});
test('Resolve records slow exposure and nominal defense contribution',()=>{
 const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8);
 const ch=makeChassis('bruiser');ch.mods.resolve=2;
 const battle=spawn([{hp:100,squad:[ch]},{hp:100,squad:[makeChassis('rogue')]}],ARENAS[0],42,1);
 const [u,v]=battle.units;
 u.effects={slowUntil:1,slowStrength:.4};
 u.bulwarkUntil=2;u.fortifyUntil=2;u.fortifyStrength=3;u.anchorUntil=2;
 near(stats(u).defense,CHASSIS.bruiser.defense+2+5+3+4);
 battle.moduleTelemetry={};
 tick(battle,STEP);
 near(battle.moduleTelemetry[u.id].resolve.slowActiveSeconds,STEP);
 near(battle.moduleTelemetry[u.id].resolve.slowFractionSecondsAvoided,.4*.8*STEP);
 u.effects.sunderUntil=2;u.effects.sunder=3;
 const hit=resolveAttackModules(battle,[{source:v,target:u,rawDamage:30,damage:30}])[0];
 near(battle.moduleTelemetry[u.id].resolve.nominalDamagePrevented,2);
 near(hit.damage,30-(CHASSIS.bruiser.defense+2+5+3+4-3));
});
