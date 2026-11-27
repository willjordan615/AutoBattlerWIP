import test from 'node:test';
import assert from 'node:assert/strict';
import {EMPIRICAL_MODEL} from '../src/draft-empirical-model.js';
import {createMatch,draftPool,legal,canEquip} from '../src/headless.js';
import {chooseCpuDraft,evaluateDraftEmpirical,scoreDraft,draftPersonality} from '../src/draft-ai.js';
test('release includes validated fitted model, not fallback',()=>{assert.equal(EMPIRICAL_MODEL.trainingBoards,394);assert.equal(EMPIRICAL_MODEL.trainingOptions,2065);assert.equal(Object.keys(EMPIRICAL_MODEL.weights).length,567);assert.ok(Object.values(EMPIRICAL_MODEL.weights).every(Number.isFinite));const a=createMatch(undefined,6501),b=createMatch(undefined,6501);draftPool(a);draftPool(b);const i=a.draft.order[a.draft.turn],p=chooseCpuDraft(a,i),q=chooseCpuDraft(b,i,{policy:'empirical'});assert.deepEqual(p,q);assert.ok(p.breakdown.some(x=>x.reason==='Measured round utility'));assert.ok(legal(a.players[i],p.card));if(p.card.kind!=='unit')assert.ok(canEquip(a.players[i].squad[p.chassisIndex],p.card));});
test('release score uses learned utility and retains distinct seeded personalities',()=>{const m=createMatch(undefined,6502);draftPool(m);const p=m.players[0],card={kind:'attack',key:'range'};assert.equal(scoreDraft(p,card),evaluateDraftEmpirical(p,card).score);assert.notDeepEqual(draftPersonality(6502,0),draftPersonality(6502,1));});
