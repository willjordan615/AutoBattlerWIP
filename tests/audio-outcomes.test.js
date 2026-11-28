import test from 'node:test';
import assert from 'node:assert/strict';
import {emitAttackOutcomes} from '../src/engine/loop.js';
test('melee outcomes distinguish contact from a miss after evasion',()=>{
 const state={visualEvents:[{kind:'attackRelease',attackId:1,delivery:'melee'},{kind:'attackRelease',attackId:2,delivery:'melee'}]};
 emitAttackOutcomes(state,[{attackId:1}],[]);
 assert.deepEqual(state.visualEvents.map(e=>e.outcome),['hit','miss']);
});
test('volley miss waits until all lanes expire and is suppressed by earlier contact',()=>{
 const volley={attackId:3},a={volley,source:{type:'ranged'},x:10,y:20,owner:0},b={...a,x:30};
 const state={visualEvents:[],projectiles:[b]};
 emitAttackOutcomes(state,[{attackId:3}],[a,b]);assert.equal(state.visualEvents.length,0);
 state.projectiles=[];emitAttackOutcomes(state,[],[b]);assert.equal(state.visualEvents.length,0);
 const missed={...a,volley:{attackId:4}},other={...b,volley:missed.volley};
 state.projectiles=[other];emitAttackOutcomes(state,[],[missed,other]);assert.equal(state.visualEvents.length,0);
 state.projectiles=[];emitAttackOutcomes(state,[],[other]);assert.equal(state.visualEvents.length,1);assert.equal(state.visualEvents[0].kind,'attackMiss');
});
