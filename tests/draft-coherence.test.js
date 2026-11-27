import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,draftPool,assign,catalog,canEquip,legal} from '../src/headless.js';
import {makeChassis} from '../src/simulation.js';
import {buildCoherence,coherenceDelta,projectDraft,equippedStrength} from '../src/draft-coherence.js';
import {evaluateDraft,evaluateDraftProfile,chooseCpuDraft} from '../src/draft-ai.js';
const c=(kind,key)=>({kind,key,name:key});
const player=()=>createMatch().players[0];
test('actual draft projection is immutable and agrees with live assignment, including hybrid bonuses and utility replacement',()=>{
 const m=createMatch(),p=m.players[0],u=p.squad[0];u.passives=['dash','regen'];u.mods.dash=2;
 for(const card of [c('target','duelist'),c('utility','backstep'),c('morphology','growth'),c('unit','ranged')]){
  const before=JSON.stringify(p),projected=projectDraft(p,card,0,0);assert.equal(JSON.stringify(p),before);
  const offer={...card,uid:'test'};m.phase='draft';m.draft={pool:[offer],originalPool:[offer],order:[0],turn:0,picks:[]};
  assign(m,0,'test',0,0);assert.deepEqual(projected,p);
 }
});
test('complementary card gains are marginal and directional pairs work both ways',()=>{
 const p=player(),u=p.squad[0];
 assert.equal(coherenceDelta(p,c('attack','momentum')).delta,0);
 u.mods.shrink=1;assert.ok(coherenceDelta(p,c('attack','momentum')).delta>0);
 u.mods.shrink=0;u.mods.momentum=1;
 assert.ok(coherenceDelta(p,c('morphology','shrink')).delta>0);
 assert.equal(coherenceDelta(p,c('morphology','growth')).delta,0);
 assert.ok(evaluateDraft(p,c('morphology','shrink')).score>evaluateDraftProfile(p,c('morphology','shrink')).score);
});
test('replacing an invested utility loses actual combinations while another slot preserves them',()=>{
 const p=player(),u=p.squad[0];u.mods.momentum=1;u.passives=['dash','regen'];u.mods.dash=2;
 const offer=c('passive','focus');
 assert.ok(coherenceDelta(p,offer,0,0).delta<0);
 assert.equal(coherenceDelta(p,offer,0,1).delta,0);
 assert.ok(evaluateDraft(p,offer,0,0).parts.some(x=>x.reason.startsWith('Lost build complement:')));
});
test('team modules value distinct teammates and real cooldown users',()=>{
 const p=player(),u=p.squad[0];u.passives=['inspiration'];
 assert.equal(buildCoherence(p).total,0);
 p.squad.push(makeChassis('rogue'));assert.equal(buildCoherence(p).total,0);
 assert.ok(coherenceDelta(p,c('utility','dash'),1).delta>0);
 assert.ok(coherenceDelta(p,c('attack','expose'),0).delta>0);
 assert.ok(coherenceDelta(p,c('attack','resonance'),1).delta>0);
});
test('cap and slot semantics prevent imaginary synergy from inactive modules',()=>{
 const p=player(),u=p.squad[0];u.mods.expose=4;u.mods.dash=2;u.mods.momentum=1;
 assert.equal(equippedStrength(u,'dash'),0);assert.equal(buildCoherence(p).total,0);
 p.squad.push(makeChassis('ranged'));assert.equal(coherenceDelta(p,c('attack','expose')).delta,0);
 u.mods.projectiles=1;assert.equal(coherenceDelta(p,c('attack','piercing'),0,0,{opponentUnits:1}).delta,0);
});
test('all legal scores finite and coherent decision deterministic',()=>{
 const a=createMatch(undefined,4531),b=createMatch(undefined,4531);draftPool(a);draftPool(b);
 assert.deepEqual(chooseCpuDraft(a,0),chooseCpuDraft(b,0));
 const p=a.players[0];for(const card of catalog)if(legal(p,card)&&canEquip(p.squad[0],card))assert.ok(Number.isFinite(evaluateDraft(p,card).score),card.key);
});
