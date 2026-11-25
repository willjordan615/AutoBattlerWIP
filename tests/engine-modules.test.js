import test from 'node:test';
import assert from 'node:assert/strict';
import {CHASSIS,ARENAS,STEP,makeChassis,stats,bound,chooseTarget,chooseMovement,holdingOpportunity,cooperativeEngagement,positionScore,clearLine,resolveCollision,tick,spawn,placementGroups,placementDamage,resolvePlayerHP,teamPercent,advanceProjectiles,PROJECTILE_SPEED,utilityCooldown,tacticalAssessment,ATTACK_TIMING,startAttack,advanceAttack,attackMovementMultiplier,meleeAttackTargets,resolveAttackModules,targetScoreDetails,ATTACK_STAGES,claimAttackEffect,applyFollowthrough,advanceFollowthrough,UTILITY_MOVE_SCALE,recentMovement,collisionStability,disengageDirection,resolveFollowthroughImpacts} from '../src/simulation.js';
import {ATTACK_MODULES,catalog,createMatch,draftPool,assign,legal,canEquip,beginCombat,completeCombat,ensureDraftChoice} from '../src/headless.js';
import {DETAILS,SUMMARIES,cardDetail,cardSummary} from '../src/module-info.js';
import {players,projectileFixture,testShot} from './simulation-fixtures.js';

test('2.7 ranged and melee range stacks increase reach by eight',()=>{
 for(const type of Object.keys(CHASSIS)){
  const unit={type,chassis:makeChassis(type)};
  const base=stats(unit).range;unit.chassis.mods.range=2;
  assert.equal(stats(unit).range,base+16);
 }
});
test('2.7 chain splits rather than duplicating damage, and cannot recurse',()=>{
 const b=spawn(players(),ARENAS[0],910),u=b.units[0],a=b.units[1],other=b.units[2];
 b.units=[u,a,other];u.x=200;u.y=200;a.x=250;a.y=200;other.x=275;other.y=220;
 u.chassis.mods.chain=1;
 const attacks=resolveAttackModules(b,[{source:u,target:a,rawDamage:20,damage:20}]);
 assert.equal(attacks.length,2);
 assert.ok(Math.abs(attacks[0].damage-(20-stats(a).defense)*.8)<1e-6);
 assert.equal(attacks[1].secondary,true);
 assert.equal(attacks[1].target,other);
 assert.ok(attacks[1].damage<=4);
 const noOther=spawn(players(),ARENAS[0],911);
 noOther.units=noOther.units.slice(0,2);noOther.units[0].chassis.mods.chain=1;
 const lone=resolveAttackModules(noOther,[{source:noOther.units[0],target:noOther.units[1],rawDamage:20,damage:20}]);
 assert.equal(lone.length,1);
 assert.ok(Math.abs(lone[0].damage-(20-stats(noOther.units[1]).defense)*.8)<1e-6);
});
test('2.7 marks, burning, hazards and slow have bounded lifetimes',()=>{
 const b=spawn(players(),ARENAS[0],912),source=b.units[0],target=b.units[1];
 source.chassis.mods.expose=1;source.chassis.mods.burning=1;
 source.chassis.mods.disruption=1;source.chassis.mods.hazardous=1;
 resolveAttackModules(b,[{source,target,rawDamage:16,damage:16}]);
 assert.ok(target.effects.expose.until>b.time);
 assert.ok(target.effects.burn.until>b.time);
 assert.ok(target.effects.slowUntil>b.time);
 assert.equal(b.zones.length,1);
 assert.ok(b.zones[0].until>b.time);
});
test('2.7 restless attack favors a different target after hitting',()=>{
 const b=spawn(players(),ARENAS[0],913),source=b.units[0],a=b.units[1],other=b.units[2];
 b.units=[source,a,other];source.x=200;source.y=200;
 a.x=280;a.y=200;other.x=280;other.y=200;
 source.chassis.mods.restless=2;
 const beforeA=targetScoreDetails(b,source,a).total;
 source.lastAttacked=a.id;source.lastAttackAt=b.time;
 assert.ok(targetScoreDetails(b,source,a).total<beforeA);
 assert.ok(targetScoreDetails(b,source,other).total>targetScoreDetails(b,source,a).total);
});

test('2.7 Sunder reduces armor only to zero and hazards cap at two per fighter',()=>{
 const b=spawn(players(),ARENAS[0],914),source=b.units[0],target=b.units[1];
 b.units=[source,target];
 source.chassis.mods.sunder=2;source.chassis.mods.hazardous=1;
 const hit=()=>resolveAttackModules(b,[{source,target,rawDamage:10,damage:10}])[0];
 const first=hit();
 assert.equal(first.damage,10-stats(target).defense);
 const second=hit();
 assert.equal(second.damage,10-Math.max(0,stats(target).defense-2));
 for(let i=0;i<5;i++){b.time+=1.01;hit()}
 assert.equal(b.zones.filter(z=>z.source.id===source.id).length,2);
 target.effects.sunder=99;target.effects.sunderUntil=b.time+2;
 assert.equal(hit().damage,10-Math.max(0,stats(target).defense-3));
});
test('2.7 burn and hazard deal environmental damage without producing additional patches',()=>{
 const b=spawn(players(),ARENAS[0],915),source=b.units[0],target=b.units[1];
 b.units=[source,target];source.x=200;source.y=220;target.x=240;target.y=220;
 source.cd=target.cd=1000;
 source.chassis.mods.burning=1;source.chassis.mods.hazardous=1;
 resolveAttackModules(b,[{source,target,rawDamage:10,damage:10}]);
 const before=target.hp,zones=b.zones.length;
 tick(b,STEP);
 assert.ok(target.hp<before);
 assert.equal(b.zones.length,zones);
});

test('2.7 Retaliation primes only from direct melee and applies once',()=>{
 const p=players(),b=spawn(p,ARENAS[0],916),source=b.units[0],defender=b.units[1];
 b.units=[source,defender];source.x=200;source.y=220;defender.x=241;defender.y=220;
 source.cd=0;defender.cd=1000;defender.chassis.passives.push('retaliation');
 for(let i=0;i<15;i++)tick(b,STEP);
 assert.ok(defender.hp<defender.maxHp,'a melee hit must land');
 assert.ok(defender.retaliationReady>b.time,'direct melee primes Retaliation');
 const first=resolveAttackModules(b,[{source:defender,target:source,rawDamage:18,damage:18}]);
 assert.equal(first[0].rawDamage,22);
 const second=resolveAttackModules(b,[{source:defender,target:source,rawDamage:18,damage:18}]);
 assert.equal(second[0].rawDamage,18);
});

test('2.7.1 burning subtracts fractional HP and emits tagged DoT damage',()=>{
 const p=players(),b=spawn(p,ARENAS[0],917),source=b.units[0],target=b.units[1];
 b.units=[source,target];source.cd=target.cd=1000;
 source.x=200;source.y=220;target.x=242;target.y=220;
 source.chassis.mods.burning=1;
 resolveAttackModules(b,[{source,target,rawDamage:10,damage:10}]);
 const before=target.hp;
 tick(b,STEP);
 const expected=2*STEP;
 assert.ok(Math.abs(before-target.hp-expected)<1e-6);
 const event=b.visualEvents.find(e=>e.kind==='dotDamage'&&e.targetId===target.id);
 assert.ok(event,'fractional environmental damage should be tagged for aggregation');
 assert.ok(Math.abs(event.value-expected)<1e-6);
 for(let i=0;i<9;i++)tick(b,STEP);
 assert.ok(Math.abs(before-target.hp-expected*10)<1e-5);
});

test('2.8 progressive squad penalty scales base HP and damage for every chassis',()=>{
 const types=['bruiser','rogue','ranged'];
 for(const type of types){
  const base=makeChassis(type);
  for(const [count,mult] of [[1,1],[2,.85],[3,.7]]){
   const s=stats({type,chassis:base,squadSize:count});
   assert.ok(Math.abs(s.hp-CHASSIS[type].hp*mult)<1e-8);
   assert.ok(Math.abs(s.damage-CHASSIS[type].damage*mult)<1e-8);
   assert.equal(s.speed,CHASSIS[type].speed);
   assert.equal(s.defense,CHASSIS[type].defense);
   assert.equal(s.rate,CHASSIS[type].rate);
   assert.equal(s.range,CHASSIS[type].range);
  }
 }
});
test('2.8 recruited chassis scales old and new team members equally',()=>{
 const p=players();
 for(const count of [1,2,3]){
  p[0].squad=Array.from({length:count},()=>makeChassis('bruiser'));
  const b=spawn(p,ARENAS[0],940+count);
  const allies=b.units.filter(u=>u.owner===0);
  assert.equal(allies.length,count);
  for(const u of allies){
   const mult=1-.15*(count-1);
   assert.equal(u.squadSize,count);
   assert.ok(Math.abs(u.maxHp-CHASSIS.bruiser.hp*mult)<1e-8);
   assert.equal(u.hp,u.maxHp);
   assert.ok(Math.abs(stats(u).damage-CHASSIS.bruiser.damage*mult)<1e-8);
  }
  assert.equal(teamPercent(b,0),1);
 }
});
test('2.8 module bonuses are not diminished by squad-size penalties',()=>{
 const chassis=makeChassis('bruiser');
 chassis.mods.hp=2;chassis.mods.damage=2;
 const one=stats({type:'bruiser',chassis,squadSize:1});
 const three=stats({type:'bruiser',chassis,squadSize:3});
 assert.ok(Math.abs(one.hp-(CHASSIS.bruiser.hp+40))<1e-8);
 assert.ok(Math.abs(three.hp-(CHASSIS.bruiser.hp*.7+40))<1e-8);
 assert.ok(Math.abs(three.damage-(CHASSIS.bruiser.damage*.7+4))<1e-8);
});

test('2.8.1 every draft option has explicit readable summary and detail',()=>{
 for(const card of catalog){
  const key=card.kind+':'+card.key;
  assert.ok(DETAILS[key],key+' missing detail');
  assert.ok(SUMMARIES[key],key+' missing summary');
  assert.ok(cardDetail(card).length>30,key+' detail too short');
  assert.ok(cardSummary(card).length>12,key+' summary too short');
  assert.ok(!/undefined|NaN|\[object Object\]/.test(cardSummary(card)+cardDetail(card)),key);
  if(card.kind==='passive'||card.kind==='utility')assert.match(cardSummary(card),/^Utility · /);
  if(card.kind==='attack')assert.match(cardSummary(card),/^Attack · /);
  if(card.kind==='target')assert.match(cardSummary(card),/^Targeting · /);
 }
 assert.equal(Object.keys(DETAILS).length,catalog.length);
 assert.equal(Object.keys(SUMMARIES).length,catalog.length);
});
test('2.8.1 descriptions capture key effects and module-slot stacking rules',()=>{
 const by=(kind,key)=>({kind,key,name:key});
 assert.match(cardDetail(by('attack','area')),/9 units of melee reach and 12°/);
 assert.match(cardDetail(by('attack','range')),/8 units/);
 assert.match(cardDetail(by('attack','chain')),/20%/);
 assert.match(cardDetail(by('attack','chain')),/own defense/);
 assert.match(cardDetail(by('attack','sunder')),/subsequent attacks/);
 assert.match(cardDetail(by('attack','expose')),/DIFFERENT fighter/);
 assert.match(cardDetail(by('attack','burning')),/2 damage per second per stack/);
 assert.match(cardDetail(by('attack','hazardous')),/up to two patches/);
 assert.match(cardDetail(by('passive','retaliation')),/direct melee hit/);
 assert.match(cardDetail(by('utility','dash')),/halves the cooldown/);
 assert.match(cardSummary(by('utility','dash')),/second copy halves cooldown/);
});
