import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,draftPool,assign,autoDraft,fight,simulate,legal} from '../src/headless.js';
test('initial draft precedes first combat',()=>{const m=createMatch();draftPool(m);assert.equal(m.phase,'draft');assert.equal(m.round,1);assert.equal(m.draft.pool.length,6)});
test('chassis cards consume shared pick and cannot exceed three',()=>{const m=createMatch();draftPool(m);const card=m.draft.pool.find(x=>x.kind==='unit');if(!card)return;assign(m,0,card.uid);assert.equal(m.players[0].squad.length,2);assert.equal(m.draft.pool.length,5);m.players[0].squad.push(m.players[0].squad[0]);assert.equal(legal(m.players[0],{kind:'unit'}),false)});
test('draft order after a round reverses placement',()=>{const m=createMatch();m.lastRanking=[0,2,1,3];draftPool(m);assert.deepEqual(m.draft.order,[3,1,2,0])});
test('each active player receives exactly one shared pick',()=>{const m=createMatch();draftPool(m);const initial=m.draft.pool.length;const picks=autoDraft(m);assert.equal(picks.length,4);assert.equal(m.draft.pool.length,initial-4);assert.equal(m.phase,'combat')});
test('passives have exactly two active slots with replacement',()=>{const m=createMatch();draftPool(m);const u=m.players[0].squad[0];u.passives=['regen','haste'];const card={uid:'forced',kind:'passive',key:'bulwark',name:'Bulwark'};m.draft.pool[0]=card;assign(m,0,card.uid,0,1);assert.deepEqual(u.passives,['regen','bulwark'])});
test('round winner is protected and drafting resumes',()=>{const m=createMatch();draftPool(m);autoDraft(m);const result=fight(m);assert.equal(m.players[result.ranking[0]].hp,100);assert.equal(m.round,2);assert.equal(m.phase,'draft')});
test('seeded matches replay identically',()=>{const a=simulate(41),b=simulate(41);assert.deepEqual(a.history,b.history);assert.equal(a.phase,'finished')});
test('thirty seeded matches terminate with one survivor',()=>{for(let seed=1;seed<=30;seed++){const m=simulate(seed,100);assert.equal(m.phase,'finished');assert.equal(m.players.filter(p=>p.hp>0).length,1)}})
