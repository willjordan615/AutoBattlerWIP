import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,draftPool,assign} from '../src/headless.js';
import {empiricalFeatures,predictDraft} from '../src/draft-empirical.js';
import {evaluateDraftEmpirical,evaluateDraftProfile} from '../src/draft-ai.js';
import {fit,rescore} from '../scripts/fit-draft-model.js';
import {sampleBoard,trial,auditBoards} from '../scripts/draft-choice-trials.js';
const c=(kind,key)=>({kind,key,name:key});
test('empirical features reflect actual removed modules and new investments',()=>{
 const p=createMatch().players[0],u=p.squad[0];u.passives=['dash','regen'];u.mods.dash=2;
 const f=empiricalFeatures(p,c('passive','focus'),0,0);
 assert.equal(f['card:dash'],-2);assert.equal(f['card:focus'],1);
 assert.equal(f['card:regen'],undefined);
});
test('fit can learn negative and positive relationships instead of assuming synergy',()=>{
 const boards=Array.from({length:12},()=>({options:[{features:{a:1},delta:.5},{features:{b:1},delta:-.5}]}));
 const m=fit(boards,{penalty:1});
 assert.ok(predictDraft({a:1},m)>0);assert.ok(predictDraft({b:1},m)<0);
 const p=createMatch().players[0];
 const model={weights:{'card:momentum':-.2,'card:precision':.2}};
 assert.ok(evaluateDraftEmpirical(p,c('attack','precision'),0,0,{}, {},model).score>evaluateDraftEmpirical(p,c('attack','momentum'),0,0,{}, {},model).score);
 assert.deepEqual(evaluateDraftEmpirical(p,c('attack','precision'),0,0,{}, {},null),evaluateDraftProfile(p,c('attack','precision')));
});
test('paired trials are deterministic and leave the actual draft untouched',()=>{
 const m=createMatch(undefined,5101);draftPool(m);
 while(m.draft.turn<m.draft.order.length-1){const i=m.draft.order[m.draft.turn];const card=m.draft.pool.find(c=>c.kind==='attack'||c.kind==='target');assign(m,i,card.uid,0,0);}
 const seat=m.draft.order[m.draft.turn],snapshot=JSON.stringify(m);
 const a=sampleBoard(m,seat,1),b=sampleBoard(m,seat,1);
 assert.deepEqual(a,b);assert.equal(JSON.stringify(m),snapshot);
 assert.ok(a.options.length>=1);assert.equal(auditBoards([a]).simulations,a.options.length+1);
});
