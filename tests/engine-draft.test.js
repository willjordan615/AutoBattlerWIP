import test from 'node:test';
import assert from 'node:assert/strict';
import {CHASSIS,ARENAS,STEP,makeChassis,stats,bound,chooseTarget,chooseMovement,holdingOpportunity,cooperativeEngagement,positionScore,clearLine,resolveCollision,tick,spawn,placementGroups,placementDamage,resolvePlayerHP,teamPercent,advanceProjectiles,PROJECTILE_SPEED,utilityCooldown,tacticalAssessment,ATTACK_TIMING,startAttack,advanceAttack,attackMovementMultiplier,meleeAttackTargets,resolveAttackModules,targetScoreDetails,ATTACK_STAGES,claimAttackEffect,applyFollowthrough,advanceFollowthrough,UTILITY_MOVE_SCALE,recentMovement,collisionStability,disengageDirection,resolveFollowthroughImpacts} from '../src/simulation.js';
import {COOPERATIVE_KEYS,ATTACK_MODULES,catalog,createMatch,draftPool,assign,legal,canEquip,beginCombat,completeCombat,ensureDraftChoice} from '../src/headless.js';
import {DETAILS,SUMMARIES,cardDetail,cardSummary} from '../src/module-info.js';
import {players,projectileFixture,testShot} from './simulation-fixtures.js';

test('draft catalog omits flat stat boosts but includes modest Range',()=>{
 for(const key of ['damage','hp','speed','rate'])assert.ok(!ATTACK_MODULES.includes(key),key);
 for(const key of ['projectiles','piercing','area','knockback','taunt','range'])assert.ok(ATTACK_MODULES.includes(key),key);
 assert.ok(!catalog.some(card=>card.kind==='attack'&&['damage','hp','speed','rate'].includes(card.key)));
});
test('duplicate utility draft upgrades existing slot to two, capped, without replacing another passive',()=>{
 const m=createMatch(['bruiser','bruiser','rogue','ranged'],12);
 m.players[0].squad[0].passives=['dash','bulwark'];
 m.players[0].squad[0].mods.dash=1;
 draftPool(m);
 m.draft.pool=[{kind:'utility',key:'dash',name:'Utility: dash',uid:'test'}];
 m.draft.originalPool=m.draft.pool.slice();m.draft.order=[0];
 assert.ok(legal(m.players[0],m.draft.pool[0]));
 assign(m,0,'test',0,1);
 const unit=m.players[0].squad[0];
 assert.deepEqual(unit.passives,['dash','bulwark']);
 assert.equal(unit.mods.dash,2);
 assert.equal(unit.modules.find(card=>card.kind==='utility').passiveSlot,1);
 assert.equal(canEquip(unit,{kind:'utility',key:'dash'}),false);
 assert.equal(utilityCooldown(5,1),5);
 assert.equal(utilityCooldown(5,2),2.5);
 assert.equal(utilityCooldown(5,99),2.5);
});
test('a third utility copy is rejected on the same chassis but can be drafted for other chassis',()=>{
 const m=createMatch(['bruiser','bruiser','rogue','ranged'],14);
 m.players[0].squad[0].passives=['dash'];
 m.players[0].squad[0].mods.dash=2;
 const offer={kind:'utility',key:'dash',uid:'test',name:'Dash'};
 draftPool(m);m.draft.pool=[offer];m.draft.order=[0];
 assert.ok(legal(m.players[0],offer)===false);
 assert.throws(()=>assign(m,0,'test',0),/Illegal draft pick|cannot equip/);
 m.players[0].squad.push(makeChassis('rogue'));
 assert.ok(legal(m.players[0],offer));
 assert.throws(()=>assign(m,0,'test',0),/cannot equip/);
 assign(m,0,'test',1);
 assert.equal(m.players[0].squad[1].mods.dash,1);
});
test('nonstacking passive duplicates are rejected without restricting the shared pool',()=>{
 const m=createMatch(['bruiser','bruiser','rogue','ranged'],19);
 m.players[0].squad[0].passives=['focus'];
 const offer={kind:'passive',key:'focus',uid:'focus',name:'Focus'};
 draftPool(m);m.draft.pool=[offer];m.draft.order=[0];
 assert.equal(legal(m.players[0],offer),false);
 assert.throws(()=>assign(m,0,'focus',0),/Illegal draft pick|cannot equip/);
 m.players[0].squad.push(makeChassis('ranged'));
 assert.equal(legal(m.players[0],offer),true);
 assign(m,0,'focus',1);
 assert.deepEqual(m.players[0].squad[1].passives,['focus']);
});
test('wall hits create lightweight wall visual signal and combat report metric',()=>{
 const b=spawn(players(),ARENAS[1],192),source=b.units[0];
 source.x=240;source.y=210;
 b.units[0].chassis=makeChassis('ranged');source.type='ranged';
 b.projectiles=[{id:1,owner:source.owner,source,aimedAtId:101,x:source.x,y:source.y,
  vx:1,vy:0,speed:1000,remaining:130,radius:3,damage:14,knockback:0,taunt:0,
  penetration:0,hitIds:new Set(),volley:{hitIds:new Set()}}];
 b.visualEvents=[];
 advanceProjectiles(b,STEP*6);
 assert.equal(source.combatStats.wallHits,1);
 assert.equal(b.projectiles.length,0);
 assert.ok(b.visualEvents.some(e=>e.kind==='wallImpact'&&Number.isFinite(e.x)));
});
test('per-unit round report balances applied damage and damage received',()=>{
 const m=createMatch(['ranged','bruiser','rogue','bruiser'],222);
 draftPool(m);
 while(m.phase==='draft'){
  const i=m.draft.order[m.draft.turn];
  assign(m,i,m.draft.pool.find(card=>legal(m.players[i],card)).uid);
 }
 const b=beginCombat(m);
 for(let t=0;t<900;t++)if(tick(b,STEP)!==null)break;
 const report=completeCombat(m,b).combatReport;
 assert.equal(report.length,b.units.length);
 assert.ok(report.every(r=>Number.isFinite(r.damage)&&Number.isFinite(r.damageTaken)&&r.damage>=0&&r.damageTaken>=0));
 const dealt=report.reduce((sum,u)=>sum+u.damage,0);
 const taken=report.reduce((sum,u)=>sum+u.damageTaken,0);
 assert.ok(Math.abs(dealt-taken)<.2,'actual applied outgoing and incoming damage should match');
});

test('shared draft preserves identical offers for competing players',()=>{
 const m=createMatch(['bruiser','bruiser','rogue','ranged'],7);
 const soloOffers=catalog.filter(c=>!COOPERATIVE_KEYS.has(c.key));
 const index=soloOffers.findIndex(c=>c.kind==='utility'&&c.key==='dash');
 m.random=()=>((index+.25)/soloOffers.length);
 draftPool(m);
 assert.equal(m.draft.originalPool.length,6);
 assert.ok(m.draft.originalPool.every(card=>card.key==='dash'&&card.kind==='utility'));
 assert.equal(new Set(m.draft.originalPool.map(card=>card.uid)).size,6);
});
