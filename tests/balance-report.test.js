import test from 'node:test';
import assert from 'node:assert/strict';
import {runBalance,formatBalance} from '../scripts/balance-report.js';

test('balance report is deterministic for a seed and strategy',()=>{
 const a=runBalance({matches:3,seed:19,mode:'strategic'});
 const b=runBalance({matches:3,seed:19,mode:'strategic'});
 assert.deepEqual(a,b);
 assert.equal(a.completed,3);
 assert.equal(a.seats.reduce((n,s)=>n+s.wins,0),3);
 assert.equal(a.combat.battles,a.combat.arenas['Open Arena']+a.combat.arenas['Twin Pillars']+a.combat.arenas['Central Barrier']);
 assert.ok(a.modules.some(x=>x.offered>=x.picked));
 assert.match(formatBalance(a),/Starting chassis/);
});
test('random baseline also finishes and produces module telemetry',()=>{
 const r=runBalance({matches:2,seed:21,mode:'random'});
 assert.equal(r.completed,2);
 assert.ok(r.modules.some(x=>x.picked>0));
 assert.ok(r.combat.battles>0);
});
test('balance report rejects invalid options',()=>{
 assert.throws(()=>runBalance({matches:0}),/matches/);
 assert.throws(()=>runBalance({mode:'invalid'}),/mode/);
});
