import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,draftPool,assign,catalog,legal,canEquip} from '../src/headless.js';
import {makeChassis} from '../src/simulation.js';
import {draftPersonality,scoreDraft,evaluateDraftLegacy,chooseCpuDraft,draftContext} from '../src/draft-ai.js';
const card=(kind,key)=>({kind,key});
test('new card profiles differentiate utility and targeting preferences',()=>{
 const p=createMatch().players[0];p.squad.push(makeChassis('ranged'));
 for(const [kind,key,trait] of [['passive','aegis','teamwork'],['attack','velocity','coverage'],['target','opportunist','focusFire'],['passive','wake','control']]){
  assert.ok(scoreDraft(p,card(kind,key),0,0,{[trait]:1})>scoreDraft(p,card(kind,key),0,0,{[trait]:-1}));
 }
});
test('recruitment considers existing specialization and real squad capacity',()=>{
 const p=createMatch().players[0],offer=card('unit','ranged'),before=scoreDraft(p,offer);
 for(let i=0;i<6;i++)p.squad[0].modules.push({kind:'attack',name:'example'});
 assert.ok(scoreDraft(p,offer)<before);
 assert.ok(scoreDraft(p,offer,0,0,{teamwork:1})>scoreDraft(p,offer,0,0,{teamwork:-1}));
});
test('capped effects lose value and high-HP preference matches Precision',()=>{
 const p=createMatch().players[0],u=p.squad[0],c=card('attack','chain');
 const base=scoreDraft(p,c);u.mods.chain=4;assert.ok(scoreDraft(p,c)<base-20);
 const q=card('attack','precision'),before=scoreDraft(p,q);u.weights.kill+=3;assert.equal(scoreDraft(p,q),before);
 u.weights.challenger+=2;assert.ok(scoreDraft(p,q)>before);
});
test('upgraded utility is costly to replace; all legal candidates score finitely',()=>{
 const m=createMatch(),p=m.players[0],u=p.squad[0];u.passives=['dash','regen'];u.mods.dash=1;
 const c=card('utility','flank'),base=scoreDraft(p,c,0,0);u.mods.dash=2;
 assert.ok(scoreDraft(p,c,0,0)<base);
 for(const offer of catalog)if(legal(p,offer)&&canEquip(u,offer))assert.ok(Number.isFinite(scoreDraft(p,offer)),offer.key);
});
test('candidate and legacy choices are repeatable and legal',()=>{
 for(const policy of ['legacy','candidate']){
  const a=createMatch(undefined,3401),b=createMatch(undefined,3401);draftPool(a);draftPool(b);
  const x=chooseCpuDraft(a,0,{policy}),y=chooseCpuDraft(b,0,{policy});assert.deepEqual(x,y);
  assert.ok(legal(a.players[0],x.card));assign(a,0,x.card.uid,x.chassisIndex,x.passiveSlot,x);
  assert.deepEqual(draftPersonality(3401,0),draftPersonality(3401,0));
 }
});
test('public remaining opponents determine coverage value and hybrid cards retain value',()=>{
 const m=createMatch(),p=m.players[0],u=p.squad[0];m.players[2].hp=m.players[3].hp=0;
 const ctx=draftContext(m,0);assert.equal(ctx.opponentUnits,1);
 const c=card('attack','chain');assert.ok(scoreDraft(p,c,0,0,{},ctx)<scoreDraft(p,c));
 assert.ok(scoreDraft(p,card('target','duelist'))>evaluateDraftLegacy(p,card('target','duelist')).score);
});
