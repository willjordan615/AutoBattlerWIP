import test from 'node:test';
import assert from 'node:assert/strict';
import {CHASSIS,ARENAS,STEP,makeChassis,stats,bound,chooseTarget,chooseMovement,holdingOpportunity,cooperativeEngagement,positionScore,clearLine,resolveCollision,tick,spawn,placementGroups,placementDamage,resolvePlayerHP,teamPercent,advanceProjectiles,PROJECTILE_SPEED,utilityCooldown,tacticalAssessment,ATTACK_TIMING,startAttack,advanceAttack,attackMovementMultiplier,meleeAttackTargets,resolveAttackModules,targetScoreDetails,ATTACK_STAGES,claimAttackEffect,applyFollowthrough,advanceFollowthrough,UTILITY_MOVE_SCALE,recentMovement,collisionStability,disengageDirection,resolveFollowthroughImpacts} from '../src/simulation.js';
import {ATTACK_MODULES,catalog,createMatch,draftPool,assign,legal,canEquip,beginCombat,completeCombat,ensureDraftChoice} from '../src/headless.js';
import {DETAILS,SUMMARIES,cardDetail,cardSummary} from '../src/module-info.js';
import {players,projectileFixture,testShot} from './simulation-fixtures.js';

test('Prototype 2.6 attack profile preserves one hit without Piercing',()=>{
 assert.equal(CHASSIS.bruiser.damage,16);
 assert.equal(ATTACK_TIMING.bruiser.arc,95);
 assert.equal(ATTACK_TIMING.rogue.windup,.18);
 assert.equal(ATTACK_TIMING.rogue.recovery,.12);
 const p=players(),b=spawn(p,ARENAS[0],894),u=b.units[0],front=b.units[1],side=b.units[2];
 b.units=[u,front,side];
 u.x=200;u.y=220;front.x=245;front.y=220;
 side.x=242;side.y=243; // Both within the narrowed sweep.
 assert.deepEqual(meleeAttackTargets(b,u,0,stats(u)).map(e=>e.id),[front.id]);
 u.chassis.mods.piercing=1;
 assert.deepEqual(meleeAttackTargets(b,u,0,stats(u)).map(e=>e.id),[front.id,side.id]);
});
test('Bruiser narrowed arc excludes a lateral opponent',()=>{
 const p=players(),b=spawn(p,ARENAS[0],895),u=b.units[0],front=b.units[1],flank=b.units[2];
 b.units=[u,front,flank];u.x=200;u.y=220;front.x=248;front.y=220;
 flank.x=220;flank.y=270;
 u.chassis.mods.piercing=1;
 assert.deepEqual(meleeAttackTargets(b,u,0,stats(u)).map(e=>e.id),[front.id]);
});
test('melee sweep hits a front target and cannot hit a rear target',()=>{
 const p=players();const b=spawn(p,ARENAS[0],889),u=b.units[0],front=b.units[1],behind=b.units[2];
 b.units=[u,front,behind];u.x=200;u.y=220;front.x=247;front.y=220;behind.x=160;behind.y=220;
 const hits=meleeAttackTargets(b,u,0,stats(u));
 assert.deepEqual(hits.map(e=>e.id),[front.id]);
});
test('rogue narrow thrust reaches beyond contact but rejects flank',()=>{
 const p=players();p[0].squad[0]=makeChassis('rogue');
 const b=spawn(p,ARENAS[0],890),u=b.units[0],front=b.units[1],off=b.units[2];
 b.units=[u,front,off];u.x=200;u.y=220;front.x=254;front.y=220;off.x=246;off.y=271;
 const hits=meleeAttackTargets(b,u,0,stats(u));
 assert.deepEqual(hits.map(e=>e.id),[front.id]);
});
test('melee direction locks during windup and target leaving arc avoids hit',()=>{
 const b=spawn(players(),ARENAS[0],891),a=b.units[0],victim=b.units[1];
 b.units=[a,victim];a.x=200;a.y=220;victim.x=247;victim.y=220;a.cd=0;victim.cd=999;
 assert.ok(startAttack(b,a,victim));
 const attacks=[];for(let i=0;i<5;i++){b.time+=STEP;advanceAttack(b,a,victim,stats(a),STEP,attacks)}
 assert.ok(a.attack.locked);
 const locked=a.attack.direction;
 victim.x=200;victim.y=268;
 for(let i=0;i<6;i++){b.time+=STEP;advanceAttack(b,a,victim,stats(a),STEP,attacks)}
 assert.equal(a.attack.direction,locked);
 assert.equal(attacks.length,0);
});
test('another opponent entering a committed swing is struck at release',()=>{
 const b=spawn(players(),ARENAS[0],892),a=b.units[0],victim=b.units[1],interloper=b.units[2];
 b.units=[a,victim,interloper];a.x=200;a.y=220;victim.x=247;victim.y=220;
 interloper.x=200;interloper.y=300;a.cd=0;victim.cd=interloper.cd=999;
 startAttack(b,a,victim);
 const attacks=[];for(let i=0;i<5;i++)advanceAttack(b,a,victim,stats(a),STEP,attacks);
 victim.x=200;victim.y=300;interloper.x=248;interloper.y=222;
 for(let i=0;i<5;i++)advanceAttack(b,a,victim,stats(a),STEP,attacks);
 assert.ok(attacks.some(hit=>hit.target===interloper));
 assert.ok(!attacks.some(hit=>hit.target===victim));
});
test('attack windup and recovery create chassis-specific movement penalties',()=>{
 for(const type of Object.keys(CHASSIS)){
  const p=players();p[0].squad[0]=makeChassis(type);
  const b=spawn(p),a=b.units[0],enemy=b.units[1];
  a.cd=0;startAttack(b,a,enemy);
  const wind=attackMovementMultiplier(a);
  assert.ok(wind<1&&wind>0);
  const attacks=[];for(let i=0;i<Math.ceil(ATTACK_TIMING[type].windup/STEP)+1;i++)
   advanceAttack(b,a,enemy,stats(a),STEP,attacks);
  assert.equal(a.attack.phase,'recovery');
  const recovery=attackMovementMultiplier(a);
  assert.ok(recovery>wind&&recovery<1);
  for(let i=0;i<Math.ceil(ATTACK_TIMING[type].recovery/STEP)+1;i++)
   advanceAttack(b,a,enemy,stats(a),STEP,attacks);
  assert.equal(a.attack,null);
  assert.equal(attackMovementMultiplier(a),1);
 }
});
test('committed attack emits a renderer-independent visual event',()=>{
 const b=spawn(players(),ARENAS[0],893),a=b.units[0],target=b.units[1];
 a.cd=0;startAttack(b,a,target);
 const hits=[];
 for(let i=0;i<Math.ceil(ATTACK_TIMING.bruiser.windup*.5/STEP)+1;i++)
  advanceAttack(b,a,target,stats(a),STEP,hits);
 assert.ok(b.visualEvents.some(e=>e.kind==='attackCommit'&&e.type==='bruiser'&&Number.isFinite(e.angle)));
});

test('ranged attack commitment imposes actual movement penalties during its attack',()=>{
 const b=spawn([{name:'Shooter',hp:100,squad:[makeChassis('ranged')]},
                {name:'Pursuer',hp:100,squad:[makeChassis('bruiser')]}],ARENAS[0],901);
 const a=b.units[0],enemy=b.units[1];
 a.x=200;a.y=220;enemy.x=340;enemy.y=220;
 a.cd=0;enemy.cd=1000;
 tick(b,STEP);
 assert.equal(a.attack?.phase,'windup');
 const firstMovement=a.move?Math.hypot(a.move.x,a.move.y)*stats(a).speed*STEP*attackMovementMultiplier(a):0;
 assert.ok(firstMovement<stats(a).speed*STEP*.5);
 for(let i=0;i<9;i++)tick(b,STEP);
 assert.ok(a.combatStats.shots>0,'release should fire after windup');
 assert.equal(a.attack?.phase,'recovery');
});
test('Dodge can interrupt uncommitted windup and enforces a brief retry delay',()=>{
 const b=spawn([{name:'Dodger',hp:100,squad:[makeChassis('bruiser')]},
                {name:'Shooter',hp:100,squad:[makeChassis('ranged')]}],ARENAS[0],902);
 const a=b.units[0],enemy=b.units[1];
 a.chassis.passives=['dodge'];a.chassis.mods.dodge=1;
 a.x=200;a.y=200;enemy.x=240;enemy.y=200;
 a.cd=0;enemy.cd=1000;startAttack(b,a,enemy);
 const shot={id:901,owner:1,source:enemy,aimedAtId:a.id,x:175,y:200,vx:1,vy:0,
 speed:320,remaining:100,radius:3,damage:10,knockback:0,taunt:0,
 penetration:0,hitIds:new Set(),volley:{hitIds:new Set()}};
 b.projectiles.push(shot);
 tick(b,STEP);
 assert.ok(a.combatStats.dodges>0);
 assert.equal(a.attack,null);
 assert.ok(a.cd>0);
});

test('Rogue base attack interval is 0.82 seconds, with unchanged commitment phases',()=>{
 assert.equal(CHASSIS.rogue.rate,.82);assert.equal(stats({type:'rogue',chassis:makeChassis('rogue')}).rate,.82);
 assert.equal(CHASSIS.rogue.speed,95.45);assert.equal(CHASSIS.rogue.damage,18);
 assert.equal(ATTACK_TIMING.rogue.windup,.18);assert.equal(ATTACK_TIMING.rogue.recovery,.12);
 assert.equal(CHASSIS.bruiser.rate,1.25);assert.equal(CHASSIS.ranged.rate,1.12);
});
