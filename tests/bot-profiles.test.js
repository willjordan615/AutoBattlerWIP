import test from 'node:test';
import assert from 'node:assert/strict';
import {BOT_STYLES,BOT_SKILLS,botProfile,modelForBot} from '../src/bot-profiles.js';
import {EMPIRICAL_MODEL} from '../src/draft-empirical-model.js';
import {createMatch,draftPool,assign,legal,canEquip} from '../src/headless.js';
import {chooseCpuDraft,draftPersonality} from '../src/draft-ai.js';
test('profiles are seeded, persist, cover every style and skill, and do not consume draft RNG',()=>{
 const seen=new Set(),counts={};
 for(let seed=1;seed<=1000;seed++)for(let seat=0;seat<4;seat++){
  const p=botProfile(seed,seat,draftPersonality(seed,seat));seen.add(p.id);counts[p.skill]=(counts[p.skill]||0)+1;
  assert.deepEqual(p,botProfile(seed,seat,draftPersonality(seed,seat)));
 }
 assert.equal(seen.size,BOT_STYLES.length*BOT_SKILLS.length);
 for(const s of BOT_SKILLS)assert.ok(Math.abs(counts[s.id]/4000-s.weight/100)<.05);
 const a=createMatch(undefined,7001),b=createMatch(undefined,7001);
 botProfile(a.seed,2,draftPersonality(a.seed,2));assert.equal(a.random(),b.random());
});
test('skill alters contextual evidence and noise, not general card values or engine stats',()=>{
 const prefs=draftPersonality(7001,0),a=botProfile(7001,0,prefs,{style:'mobile',skill:'casual'}),b=botProfile(7001,0,prefs,{style:'mobile',skill:'experienced'});
 assert.deepEqual(a.preferences,b.preferences);assert.ok(a.noise>b.noise);
 const am=modelForBot(a),bm=modelForBot(b);assert.equal(bm.weights['card:growth'],am.weights['card:growth']);
 const k=Object.keys(EMPIRICAL_MODEL.weights).find(x=>x.startsWith('pair:'));
 assert.ok(Math.abs(am.weights[k])<Math.abs(bm.weights[k]));
 assert.throws(()=>botProfile(7001,0,prefs,{skill:'unknown'}));
});
test('profiled CPU choices are deterministic, legal and persist in draft records',()=>{
 for(const skill of BOT_SKILLS){
  const a=createMatch(undefined,7002),b=createMatch(undefined,7002);draftPool(a);draftPool(b);
  const opts={policy:'profiled',profile:{skill:skill.id,style:'cooperative'}};
  const p=chooseCpuDraft(a,0,opts),q=chooseCpuDraft(b,0,opts);assert.deepEqual(p,q);
  assert.ok(legal(a.players[0],p.card));if(p.card.kind!=='unit')assert.ok(canEquip(a.players[0].squad[p.chassisIndex],p.card));
  assert.equal(p.profile.skill,skill.id);assert.equal(p.profile.style,'cooperative');
  assign(a,0,p.card.uid,p.chassisIndex,p.passiveSlot,p);
  assert.deepEqual(a.draft.picks[0].reasoning.profile,p.profile);
  assert.ok(p.variation<=skill.noise);
 }
});
test('explicit empirical policy still uses original seed personality and variation',()=>{
 const a=createMatch(undefined,7003);draftPool(a);const p=chooseCpuDraft(a,0,{policy:'empirical'});
 assert.equal(p.profile,undefined);assert.deepEqual(p.preferences,draftPersonality(a.seed,0));assert.ok(p.variation<=2.5);
});
