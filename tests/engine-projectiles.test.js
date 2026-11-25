import test from 'node:test';
import assert from 'node:assert/strict';
import {CHASSIS,ARENAS,STEP,makeChassis,stats,bound,chooseTarget,chooseMovement,holdingOpportunity,cooperativeEngagement,positionScore,clearLine,resolveCollision,tick,spawn,placementGroups,placementDamage,resolvePlayerHP,teamPercent,advanceProjectiles,PROJECTILE_SPEED,utilityCooldown,tacticalAssessment,ATTACK_TIMING,startAttack,advanceAttack,attackMovementMultiplier,meleeAttackTargets,resolveAttackModules,targetScoreDetails,ATTACK_STAGES,claimAttackEffect,applyFollowthrough,advanceFollowthrough,UTILITY_MOVE_SCALE,recentMovement,collisionStability,disengageDirection,resolveFollowthroughImpacts} from '../src/simulation.js';
import {ATTACK_MODULES,catalog,createMatch,draftPool,assign,legal,canEquip,beginCombat,completeCombat,ensureDraftChoice} from '../src/headless.js';
import {DETAILS,SUMMARIES,cardDetail,cardSummary} from '../src/module-info.js';
import {players,projectileFixture,testShot} from './simulation-fixtures.js';

test('wall absorbs projectile before any enemy behind it',()=>{
 const b=projectileFixture(ARENAS[1]),a=b.units[0],enemy=b.units[1];
 a.x=240;a.y=210;enemy.x=350;enemy.y=210;
 testShot(b,a,{remaining:150});
 const hits=advanceProjectiles(b,1);
 assert.equal(hits.length,0);
 assert.equal(b.projectiles.length,0);
 assert.ok(!b.visualEvents.some(e=>e.kind==='impact'));
});
test('front enemy intercepts a shot intended for a rear enemy',()=>{
 const b=projectileFixture(ARENAS[0],['ranged','bruiser','bruiser']);
 const [a,front,back]=b.units;a.x=100;a.y=200;
 front.x=155;front.y=200;back.x=210;back.y=200;
 testShot(b,a,{remaining:180});
 const hits=advanceProjectiles(b,1);
 assert.deepEqual(hits.map(h=>h.target.id),[front.id]);
 assert.equal(b.projectiles.length,0);
});
test('friendly units do not intercept friendly shots',()=>{
 const b=projectileFixture(ARENAS[0],['ranged','bruiser','bruiser']);
 const [a,ally,enemy]=b.units;
 a.owner=ally.owner=0;enemy.owner=1;
 a.x=100;a.y=200;ally.x=150;ally.y=200;
 enemy.x=210;enemy.y=200;
 testShot(b,a,{remaining:170});
 const hits=advanceProjectiles(b,1);
 assert.deepEqual(hits.map(h=>h.target.id),[enemy.id]);
});
test('piercing can hit multiple enemies, each at most once, along one path',()=>{
 const b=projectileFixture(ARENAS[0],['ranged','bruiser','bruiser','bruiser']);
 const [a,one,two,three]=b.units;
 a.x=100;a.y=200;one.x=145;two.x=190;three.x=235;
 one.y=two.y=three.y=200;
 testShot(b,a,{remaining:180,piercing:1});
 const hits=advanceProjectiles(b,1);
 assert.deepEqual(hits.map(h=>h.target.id),[one.id,two.id]);
 assert.equal(b.projectiles.length,0);
 assert.equal(b.visualEvents.filter(e=>e.kind==='impact').length,2);
});
test('swept projectile collision cannot skip small targets at high velocity',()=>{
 const b=projectileFixture(ARENAS[0]),[a,enemy]=b.units;
 a.x=100;a.y=200;enemy.x=200;enemy.y=200;
 testShot(b,a,{speed:12000,remaining:180});
 assert.deepEqual(advanceProjectiles(b,STEP).map(h=>h.target.id),[enemy.id]);
});
test('projectiles expire at range and arena boundaries',()=>{
 const b=projectileFixture(ARENAS[0]),[a,enemy]=b.units;
 a.x=100;a.y=200;enemy.x=300;enemy.y=300;
 testShot(b,a,{remaining:35});
 assert.equal(advanceProjectiles(b,1).length,0);
 assert.equal(b.projectiles.length,0);
 a.x=680;a.y=200;
 testShot(b,a,{remaining:120});
 assert.equal(advanceProjectiles(b,1).length,0);
 assert.equal(b.projectiles.length,0);
});
test('separate lanes cannot damage an intercepted unit twice in the same volley',()=>{
 const b=projectileFixture(),[a,enemy]=b.units;
 a.x=100;a.y=200;enemy.x=155;enemy.y=200;
 const volley={hitIds:new Set()};
 const first=testShot(b,a);first.volley=volley;
 const second=testShot(b,a);second.volley=volley;
 const hits=advanceProjectiles(b,1);
 assert.deepEqual(hits.map(h=>h.target.id),[enemy.id]);
});
