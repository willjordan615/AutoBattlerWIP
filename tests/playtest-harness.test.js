import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaytest,cpuPolicy,playBatch} from '../scripts/playtest-harness.js';

test('agent receives legal choices and can draft and inspect a battle',()=>{
 const game=createPlaytest({seed:20261121,traceInterval:2});
 const before=game.state();
 assert.equal(before.phase,'draft');
 assert.ok(before.draft.choices.length>0);
 assert.equal(Object.keys(before.players[0].squad[0].weights).length,10);
 const decision=cpuPolicy(before);
 const after=game.pick(decision.uid,decision.slot,decision.passiveSlot);
 assert.equal(after.phase,'combat');
 const {report,state}=game.fight();
 assert.equal(report.round,1);
 assert.equal(report.ranking.length,4);
 assert.ok(report.frames.length>1);
 assert.ok(report.frames[0].units.length>=4);
 assert.ok(state.history.some(e=>e.kind==='combat'));
});

test('illegal choices are rejected without changing the draft',()=>{
 const game=createPlaytest({seed:12});
 assert.throws(()=>game.pick('nonexistent'),/Illegal pick/);
 assert.equal(game.state().phase,'draft');
});

test('repeatable complete match and batch report',()=>{
 const first=createPlaytest({seed:44}).run(cpuPolicy,{trace:false});
 const second=createPlaytest({seed:44}).run(cpuPolicy,{trace:false});
 assert.deepEqual(first,second);
 assert.equal(first.completed,true);
 assert.ok(first.rounds.length>0);
 assert.ok(first.rounds.every(r=>r.frames.length===0));
 const batch=playBatch({matches:2,seed:55});
 assert.equal(batch.matches,2);
 assert.equal(batch.results.length,2);
 assert.ok(batch.winRate>=0&&batch.winRate<=1);
});
