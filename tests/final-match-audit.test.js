import test from 'node:test';
import assert from 'node:assert/strict';
import {runBalance} from '../scripts/balance-report.js';
test('3.2 final full-match audit: random',()=>{
 const r=runBalance({matches:80,seed:9701,mode:'random'});
 console.log('FINAL_MATCH '+JSON.stringify({config:r.config,completed:r.completed,averageRounds:r.averageRounds,minRounds:r.minRounds,maxRounds:r.maxRoundsObserved,combat:r.combat,startingChassis:r.startingChassis,seats:r.seats,flags:r.flags,rosterSizes:r.rosterSizes,picksByKind:r.picksByKind}));
 for(const m of r.modules)console.log('FINAL_MODULE '+JSON.stringify(m));
 assert.equal(r.completed,80);
});
