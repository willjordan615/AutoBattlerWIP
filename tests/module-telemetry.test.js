import test from 'node:test';
import assert from 'node:assert/strict';
import {catalog} from '../src/headless.js';
import {moduleTrial,compareModules} from '../scripts/module-comparison.js';
test('telemetry does not alter deterministic combat',()=>{const args={seed:3101,type:'rogue',size:2,teams:2,card:catalog.find(c=>c.key==='siphon'),stacks:1,enabled:true};const a=moduleTrial({...args,telemetry:true}),b=moduleTrial({...args,telemetry:false});assert.deepEqual(a.signature,b.signature);assert.equal(a.placement,b.placement);assert.equal(a.damage,b.damage);});
test('paired report stratifies trials and records measured effects',()=>{const r=compareModules({keys:['velocity'],seeds:1,sizes:[1],teams:[2],stackCounts:[1],backgrounds:[false]});assert.equal(r.pairedRounds,3);assert.equal(r.rows.length,3);for(const row of r.rows){assert.equal(row.improved+row.worse+row.unchanged,1);assert.ok(row.metrics.releases>0);}});
