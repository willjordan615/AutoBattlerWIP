import test from 'node:test';
import assert from 'node:assert/strict';
import {runBalance} from '../scripts/balance-report.js';
test('full-match balance cross-check (random)',()=>{
 const r=runBalance({matches:60,seed:9701,mode:'random'});
 console.log('BALANCE_CONFIG '+JSON.stringify({config:r.config,completed:r.completed,averageRounds:r.averageRounds,combat:r.combat,startingChassis:r.startingChassis,seats:r.seats,flags:r.flags}));
 for(const m of r.modules)console.log('BALANCE_ROW '+JSON.stringify(m));
 assert.equal(r.completed,60);
});
