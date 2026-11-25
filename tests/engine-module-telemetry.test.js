import test from 'node:test';
import assert from 'node:assert/strict';
import {CHASSIS,ARENAS,STEP,makeChassis,stats,bound,chooseTarget,chooseMovement,holdingOpportunity,cooperativeEngagement,positionScore,clearLine,resolveCollision,tick,spawn,placementGroups,placementDamage,resolvePlayerHP,teamPercent,advanceProjectiles,PROJECTILE_SPEED,utilityCooldown,tacticalAssessment,ATTACK_TIMING,startAttack,advanceAttack,attackMovementMultiplier,meleeAttackTargets,resolveAttackModules,targetScoreDetails,ATTACK_STAGES,claimAttackEffect,applyFollowthrough,advanceFollowthrough,UTILITY_MOVE_SCALE,recentMovement,collisionStability,disengageDirection,resolveFollowthroughImpacts} from '../src/simulation.js';
import {ATTACK_MODULES,catalog,createMatch,draftPool,assign,legal,canEquip,beginCombat,completeCombat,ensureDraftChoice} from '../src/headless.js';
import {DETAILS,SUMMARIES,cardDetail,cardSummary} from '../src/module-info.js';
import {players,projectileFixture,testShot} from './simulation-fixtures.js';

test('2.9.1 direct bonus telemetry separately credits damage and respects HP cap',()=>{
 const p=players(),b=spawn(p,ARENAS[0],2010),source=b.units[0],target=b.units[1];
 b.units=[source,target];source.cd=target.cd=1e4;
 source.chassis.mods.precision=1;source.chassis.mods.momentum=1;
 source.motion=[{time:0,x:source.x-50,y:source.y},{time:0,x:source.x,y:source.y}];
 b.time=.01;
 const hit=resolveAttackModules(b,[{source,target,rawDamage:16,damage:16}])[0];
 assert.ok(hit.moduleDamage.precision>0);
 assert.ok(hit.moduleDamage.momentum>0);
 assert.equal(hit.moduleDamage.precision,2);
 assert.ok(Math.abs(hit.moduleDamage.momentum-1)<1e-9);
});
test('2.9.1 Sunder, Expose, Chain and Retaliation capture measurable contributions',()=>{
 const p=players(),b=spawn(p,ARENAS[0],2011),source=b.units[0],ally=b.units[1],enemy=b.units[2],extra=b.units[3];
 source.owner=ally.owner=0;enemy.owner=extra.owner=1;
 enemy.type='bruiser';enemy.chassis=makeChassis('bruiser');
 source.x=ally.x=180;source.y=ally.y=200;
 enemy.x=240;enemy.y=200;extra.x=260;extra.y=200;
 b.units=[source,ally,enemy,extra];
 source.chassis.mods.expose=2;source.chassis.mods.sunder=2;
 resolveAttackModules(b,[{source,target:enemy,rawDamage:20,damage:20}]);
 const follow=resolveAttackModules(b,[{source:ally,target:enemy,rawDamage:20,damage:20}])[0];
 assert.equal(follow.moduleDamage.expose,4);
 assert.equal(follow.moduleDamage.sunder,Math.min(2,stats(enemy).defense));
 ally.retaliationReady=b.time+4;
 const answer=resolveAttackModules(b,[{source:ally,target:enemy,rawDamage:20,damage:20}])[0];
 assert.equal(answer.moduleDamage.retaliation,4);
 ally.chassis.mods.chain=1;
 const chained=resolveAttackModules(b,[{source:ally,target:enemy,rawDamage:20,damage:20}]);
 assert.equal(chained.length,2);
 assert.equal(chained[1].moduleDamage.chain,chained[1].damage);
});
test('2.9.1 burn and hazard ticks retain source module identification',()=>{
 const p=players(),b=spawn(p,ARENAS[0],2012),source=b.units[0],target=b.units[1];
 b.units=[source,target];source.x=200;source.y=200;target.x=240;target.y=200;
 source.cd=target.cd=1e4;source.chassis.mods.burning=1;source.chassis.mods.hazardous=1;
 resolveAttackModules(b,[{source,target,rawDamage:16,damage:16}]);
 tick(b,STEP);
 assert.ok(source.combatStats.moduleDamage.burning>0);
 assert.ok(source.combatStats.moduleDamage.hazardous>0);
 assert.ok(Math.abs(source.combatStats.moduleDamage.burning-2*STEP)<1e-6);
 assert.ok(Math.abs(source.combatStats.moduleDamage.hazardous-2*STEP)<1e-6);
});
test('2.9.1 round combat report preserves module damage and delivered-impact fields',()=>{
 const match=createMatch(),battle=spawn(match.players,ARENAS[0],2013);
 const u=battle.units[0];u.combatStats.damage=12;
 u.combatStats.moduleDamage={burning:1.2567,precision:2};
 u.combatStats.moduleHits={piercing:4.321};
 u.combatStats.chainRedirected=3.135;
 // Completion accepts a finished battle and preserves its unit-level measurements.
 match.phase='combat';battle.time=30;const report=completeCombat(match,battle).combatReport[0];
 assert.equal(report.moduleDamage.burning,1.26);
 assert.equal(report.moduleDamage.precision,2);
 assert.equal(report.moduleHits.piercing,4.32);
 assert.equal(report.chainRedirected,3.14);
});

test('2.9.1 effective damage attribution cannot exceed real damage dealt to low-HP targets',()=>{
 const p=players(),b=spawn(p,ARENAS[0],2020),source=b.units[0],target=b.units[1];
 b.units=[source,target];source.x=200;source.y=220;target.x=248;target.y=220;
 source.cd=0;target.cd=1e4;target.maxHp=target.hp=2;
 source.chassis.mods.precision=2;
 // Low target HP should limit actual attributed damage and eliminate overkill credit.
 source.chassis.mods.momentum=4;
 const hit=resolveAttackModules(b,[{source,target,rawDamage:16,damage:16}])[0];
 assert.ok(hit.moduleDamage.precision>0);
 // Force this resolved hit through standard accounting via a deterministic melee exchange.
 const tagged=spawn(p,ARENAS[0],2021),a=tagged.units[0],v=tagged.units[1];
 tagged.units=[a,v];a.x=200;a.y=220;v.x=249;v.y=220;
 a.cd=0;v.cd=1e4;v.maxHp=v.hp=2;a.chassis.mods.precision=2;
 for(let i=0;i<16;i++)tick(tagged,STEP);
 const total=Object.values(a.combatStats.moduleDamage).reduce((x,y)=>x+y,0);
 assert.ok(total<=2+1e-6,'no more damage can be credited than actually dealt');
 assert.ok(a.combatStats.damage<=2+1e-6);
});
test('2.9.1 delivered-hit telemetry is explicitly separate from additive damage',()=>{
 const p=players(),b=spawn(p,ARENAS[0],2022),source=b.units[0],target=b.units[1];
 b.units=[source,target];source.x=200;source.y=220;target.x=245;target.y=220;
 source.chassis.mods.piercing=1;source.cd=0;target.cd=1e4;
 for(let i=0;i<16;i++)tick(b,STEP);
 assert.ok(source.combatStats.damage>0);
 assert.ok(source.combatStats.moduleHits);
 assert.ok(source.combatStats.moduleDamage);
 assert.equal(source.combatStats.moduleHits.piercing||0,0,'a single enemy is not a piercing follow-up');
});

test('2.10 every attack module has a compositional stage',()=>{
 assert.deepEqual([...Object.keys(ATTACK_STAGES)].sort(),ATTACK_MODULES.slice().sort());
 for(const [key,meta] of Object.entries(ATTACK_STAGES)){
  assert.ok(['shape','impact','aftermath','condition','targeting'].includes(meta.stage),key);
  assert.ok(meta.label,key);
 }
 assert.equal(ATTACK_STAGES.burning.cooldown,1);
 assert.equal(ATTACK_STAGES.hazardous.cooldown,1);
 assert.equal(ATTACK_STAGES.momentum.cooldown,undefined);
});
test('2.10 aftermath effects proc once per second independently, while keeping all targets in one attack',()=>{
 const b=spawn(players(),ARENAS[0],3020),source=b.units[0],a=b.units[1],other=b.units[2];
 b.units=[source,a,other];source.chassis.mods.burning=source.chassis.mods.hazardous=1;
 b.time=.05;
 resolveAttackModules(b,[{source,target:a,attackId:100,rawDamage:12},
  {source,target:other,attackId:100,rawDamage:12}]);
 assert.ok(a.effects.burn&&other.effects.burn);
 assert.equal(b.zones.length,2);
 const until=a.effects.burn.until;
 b.time=.4;
 resolveAttackModules(b,[{source,target:a,attackId:101,rawDamage:12}]);
 assert.equal(a.effects.burn.until,until);
 assert.equal(b.zones.length,2);
 b.time=.7;
 assert.ok(!claimAttackEffect(source,'hazardous',102,b.time));
 assert.ok(!claimAttackEffect(source,'burning',102,b.time));
 b.time=1.06;
 resolveAttackModules(b,[{source,target:a,attackId:102,rawDamage:12}]);
 assert.ok(a.effects.burn.until>until);
 assert.equal(b.zones.length,2);
 assert.ok(b.zones.some(z=>z.until>3));
});
test('2.10 effect cooldowns are per chassis and do not gate conditional hit damage',()=>{
 const b=spawn(players(),ARENAS[0],3021),source=b.units[0],target=b.units[1],other=b.units[2];
 b.units=[source,target,other];
 source.chassis.mods.burning=1;source.chassis.mods.precision=1;
 other.chassis.mods.burning=1;
 b.time=.1;
 const first=resolveAttackModules(b,[{source,target,attackId:1,rawDamage:12}])[0];
 assert.ok(first.moduleDamage.precision>0);
 assert.ok(claimAttackEffect(other,'burning',2,b.time));
 assert.ok(!claimAttackEffect(source,'burning',3,b.time));
 const next=resolveAttackModules(b,[{source,target,attackId:4,rawDamage:12}])[0];
 assert.equal(next.moduleDamage.precision,first.moduleDamage.precision);
});
test('2.10 same attack identifier can affect late-arriving projectile targets without reopening cooldown',()=>{
 const b=spawn(players(),ARENAS[0],3022),source=b.units[0],target=b.units[1],other=b.units[2];
 source.chassis.mods.burning=1;b.units=[source,target,other];
 b.time=.1;resolveAttackModules(b,[{source,target,attackId:55,rawDamage:12}]);
 b.time=.65;resolveAttackModules(b,[{source,target:other,attackId:55,rawDamage:12}]);
 assert.ok(other.effects.burn);
 assert.ok(!claimAttackEffect(source,'burning',56,b.time));
});
