import test from 'node:test';
import assert from 'node:assert/strict';
import {ARENAS,STEP,makeChassis,spawn,tick} from '../src/simulation.js';

test('3.3 decision diagnostics preserve seeded round state and expose choices',()=>{
 const make=()=>spawn(['bruiser','rogue','ranged','bruiser'].map((type,i)=>({name:'P'+i,hp:100,squad:[makeChassis(type)]})),ARENAS[0],123);
 const a=make(),b=make();b.decisionAudit={interval:5,limit:20,units:{}};
 const snapshot=x=>JSON.stringify(x,(k,v)=>k==='decisionAudit'?undefined:v instanceof Set?[...v]:v instanceof Map?[...v]:v);
 for(let i=0;i<120;i++){
  assert.deepEqual(tick(a,STEP),tick(b,STEP));
  assert.equal(snapshot(a),snapshot(b));
 }
 const rows=Object.values(b.decisionAudit.units);
 assert.ok(rows.length===4);
 assert.ok(rows.every(r=>r.counts.actionCalls>0&&r.targets.length>0&&r.moves.length>0));
 assert.ok(rows.some(r=>r.targets.some(t=>t.chosen&&t.alternative)));
 assert.ok(rows.some(r=>r.freeChoices?.some(t=>t.chosen&&t.alternative)));
 assert.ok(rows.every(r=>r.targets.length<=20&&r.moves.length<=20&&(r.freeChoices?.length||0)<=20));
});
