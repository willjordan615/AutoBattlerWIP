import test from 'node:test';
import assert from 'node:assert/strict';
import {CHASSIS,ARENAS,STEP,makeChassis,stats,bound,chooseTarget,chooseMovement,holdingOpportunity,cooperativeEngagement,positionScore,clearLine,resolveCollision,tick,spawn,placementGroups,placementDamage,resolvePlayerHP,teamPercent,advanceProjectiles,PROJECTILE_SPEED,utilityCooldown,tacticalAssessment,ATTACK_TIMING,startAttack,advanceAttack,attackMovementMultiplier,meleeAttackTargets,resolveAttackModules,targetScoreDetails,ATTACK_STAGES,claimAttackEffect,applyFollowthrough,advanceFollowthrough,UTILITY_MOVE_SCALE,recentMovement,collisionStability,disengageDirection,resolveFollowthroughImpacts} from '../src/simulation.js';
import {ATTACK_MODULES,catalog,createMatch,draftPool,assign,legal,canEquip,beginCombat,completeCombat,ensureDraftChoice} from '../src/headless.js';
import {DETAILS,SUMMARIES,cardDetail,cardSummary} from '../src/module-info.js';
import {players,projectileFixture,testShot} from './simulation-fixtures.js';

test('reactive dodge avoids a threatening projectile but does not react to a miss',()=>{
 const run=(y)=>{
  const b=projectileFixture(ARENAS[0],['bruiser','ranged']);
  const defender=b.units[0],shooter=b.units[1];
  defender.chassis.passives.push('dodge');defender.chassis.mods.dodge=1;
  defender.x=180;defender.y=210;shooter.x=95;shooter.y=350;
  defender.cd=100;shooter.cd=100;
  testShot(b,shooter,{vx:1,vy:0,remaining:200});
  const shot=b.projectiles[0];shot.y=y;shot.x=135;shot.aimedAtId=defender.id;
  tick(b,STEP);
  return {b,defender};
 };
 const direct=run(210);
 assert.equal(direct.defender.combatStats.dodges,1);
 assert.ok(direct.b.visualEvents.some(e=>e.kind==='mobility'&&e.ability==='dodge'));
 assert.ok(direct.b.visualEvents.some(e=>e.kind==='mobility'&&e.ability==='dodge'&&e.type==='bruiser'),
  'Dodge afterimage event identifies the original fighter chassis');
 const miss=run(100);
 assert.equal(miss.defender.combatStats.dodges,0);
});
test('haste reacts to pursuit and focus reacts to a finish opportunity',()=>{
 const b=projectileFixture(ARENAS[0],['bruiser','bruiser']);
 const [pursuer,target]=b.units;
 pursuer.chassis.passives=['haste','focus'];pursuer.x=90;pursuer.y=220;
 target.x=270;target.y=220;target.cd=1000;pursuer.cd=1000;
 tick(b,STEP);assert.equal(pursuer.combatStats.haste,1);
 assert.ok(pursuer.hasteUntil>b.time);
 pursuer.x=240;target.hp=16;pursuer.cd=0;
 tick(b,STEP);assert.equal(pursuer.combatStats.focus,1);
 assert.ok(pursuer.focusUntil>b.time);
});
test('bulwark prepares before a dangerous attack rather than providing permanent defense',()=>{
 const b=projectileFixture(ARENAS[0],['bruiser','bruiser']);
 const [defender,attacker]=b.units;defender.chassis.passives=['bulwark'];
 defender.x=180;defender.y=210;attacker.x=215;attacker.y=210;
 attacker.cd=0;defender.cd=1000;
 assert.equal(stats(defender).defense,4);
 for(let i=0;i<6;i++)tick(b,STEP);
 assert.equal(defender.combatStats.bulwark,1);
 assert.ok(defender.bulwarkUntil>b.time);
 assert.equal(stats(defender).defense,7);
});
test('fully unusable shared board gets one legal fallback without removing duplicates prematurely',()=>{
 const m=createMatch(['bruiser','bruiser'],151);draftPool(m);
 const p=m.players[0];p.squad=[makeChassis('bruiser'),makeChassis('rogue'),makeChassis('ranged')];
 for(const u of p.squad){u.passives=['focus','regen'];u.mods.dash=2}
 const dead={kind:'passive',key:'focus',name:'Passive: focus',uid:'x'};
 m.draft.pool=[{...dead},{...dead,uid:'y'}];
 m.draft.originalPool=m.draft.pool.map(x=>({...x}));
 m.draft.order=[0,1];m.draft.turn=0;
 ensureDraftChoice(m);
 assert.equal(m.draft.pool.length,2);
 assert.ok(m.draft.pool.some(c=>legal(p,c)));
 assert.ok(m.draft.originalPool.some(c=>c.kind==='target'));
});

test('Dodge does not consume cooldown on a projectile still outside reaction horizon',()=>{
 const b=projectileFixture(ARENAS[0],['bruiser','ranged']);
 const [defender,shooter]=b.units;
 defender.chassis.passives=['dodge'];defender.chassis.mods.dodge=1;
 defender.x=290;defender.y=210;defender.cd=1000;
 shooter.x=70;shooter.y=210;shooter.cd=1000;
 const shot=testShot(b,shooter,{remaining:300});
 shot.x=90;shot.y=210;shot.aimedAtId=defender.id;
 tick(b,STEP);
 assert.equal(defender.combatStats.dodges,0);
 assert.equal(defender.reactionCd.dodge||0,0);
});
test('Focus saves its burst for a multi-hit finish and not an automatic one-shot',()=>{
 const b=projectileFixture(ARENAS[0],['bruiser','bruiser']);
 const [attacker,target]=b.units;
 attacker.chassis.passives=['focus'];attacker.x=200;attacker.y=210;
 target.x=237;target.y=210;target.cd=1000;
 attacker.cd=0;target.hp=3;tick(b,STEP);
 assert.equal(attacker.combatStats.focus,0);
 const another=projectileFixture(ARENAS[0],['bruiser','bruiser']);
 const [a,t]=another.units;a.chassis.passives=['focus'];a.x=200;a.y=210;
 t.x=237;t.y=210;a.cd=0;t.cd=1000;t.hp=16;
 tick(another,STEP);
 assert.equal(a.combatStats.focus,1);
});
test('Dodge ignores distant projectile paths even when nearby enemy is ranged',()=>{
 const b=projectileFixture(ARENAS[0],['bruiser','ranged']);
 const [d,r]=b.units;
 d.chassis.passives=['dodge'];d.chassis.mods.dodge=1;
 d.x=200;d.y=200;r.x=215;r.y=200;d.cd=1000;r.cd=1000;
 tick(b,STEP);
 assert.equal(d.combatStats.dodges,0);
});
test('Haste does not repeatedly activate while already active',()=>{
 const b=projectileFixture(ARENAS[0],['bruiser','bruiser']);
 const [a,t]=b.units;
 a.chassis.passives=['haste'];a.x=80;a.y=210;t.x=320;t.y=210;
 t.cd=1000;
 tick(b,STEP);
 assert.equal(a.combatStats.haste,1);
 for(let i=0;i<30;i++)tick(b,STEP);
 assert.equal(a.combatStats.haste,1);
});
