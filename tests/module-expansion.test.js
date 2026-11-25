import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,cooperativeWeight,draftPool,COOPERATIVE_KEYS,catalog} from '../src/headless.js';
import {makeChassis,attackWindup,ATTACK_TIMING} from '../src/simulation.js';
import {cardDetail} from '../src/module-info.js';
test('cooperative availability ignores eliminated teams',()=>{const m=createMatch();assert.equal(cooperativeWeight(m.players),0);m.players[0].squad.push(makeChassis('rogue'));assert.equal(cooperativeWeight(m.players),.25);m.players[3].hp=0;assert.equal(cooperativeWeight(m.players),1/3);m.players[2].hp=0;assert.equal(cooperativeWeight(m.players),.5);m.players[1].squad.push(makeChassis('rogue'));assert.equal(cooperativeWeight(m.players),1);});
test('solo draft excludes cooperative cards, including replacements',()=>{for(let seed=1;seed<=100;seed++){const m=createMatch(undefined,seed);draftPool(m);assert.ok(m.draft.pool.every(c=>!COOPERATIVE_KEYS.has(c.key)));}});
test('velocity reduces melee windup only',()=>{for(const type of ['bruiser','rogue','ranged']){const u={type,chassis:makeChassis(type)};u.chassis.mods.velocity=1;assert.ok(type==='ranged'?attackWindup(u)===ATTACK_TIMING[type].windup:attackWindup(u)<ATTACK_TIMING[type].windup);}});
test('catalog modules have descriptions and initialized attack fields',()=>{for(const c of catalog){assert.ok(cardDetail(c));if(c.kind==='attack')assert.equal(makeChassis('bruiser').mods[c.key],0);}});
