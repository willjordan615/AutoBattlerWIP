import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,draftPool,assign,autoDraft,fight,simulate,legal,beginCombat,completeCombat,rankRound} from '../src/headless.js';
import {tick,STEP,spawn,makeChassis} from '../src/simulation.js';
import {scoreDraft,evaluateDraft,draftPersonality,chooseCpuDraft} from '../src/draft-ai.js';
test('initial draft precedes first combat',()=>{const m=createMatch();draftPool(m);assert.equal(m.phase,'draft');assert.equal(m.round,1);assert.equal(m.draft.pool.length,6)});
test('chassis cards consume shared pick and cannot exceed three',()=>{const m=createMatch();draftPool(m);const card=m.draft.pool.find(x=>x.kind==='unit');if(!card)return;assign(m,0,card.uid);assert.equal(m.players[0].squad.length,2);assert.equal(m.draft.pool.length,5);m.players[0].squad.push(m.players[0].squad[0]);assert.equal(legal(m.players[0],{kind:'unit'}),false)});
test('draft order after a round reverses placement',()=>{const m=createMatch();m.lastRanking=[0,2,1,3];draftPool(m);assert.deepEqual(m.draft.order,[3,1,2,0])});
test('each active player receives exactly one shared pick',()=>{const m=createMatch();draftPool(m);const initial=m.draft.pool.length;const picks=autoDraft(m);assert.equal(picks.length,4);assert.equal(m.draft.pool.length,initial-4);assert.equal(m.phase,'combat')});
test('passives have exactly two active slots with replacement',()=>{const m=createMatch();draftPool(m);const u=m.players[0].squad[0];u.passives=['regen','haste'];const card={uid:'forced',kind:'passive',key:'bulwark',name:'Bulwark'};m.draft.pool[0]=card;assign(m,0,card.uid,0,1);assert.deepEqual(u.passives,['regen','bulwark'])});
test('round winner is protected and drafting resumes',()=>{const m=createMatch();draftPool(m);autoDraft(m);const result=fight(m);assert.equal(m.players[result.ranking[0]].hp,100);assert.equal(m.round,2);assert.equal(m.phase,'draft')});
test('seeded matches replay identically',()=>{const a=simulate(41),b=simulate(41);assert.deepEqual(a.history,b.history);assert.equal(a.phase,'finished')});
test('thirty seeded matches terminate with one survivor',()=>{for(let seed=1;seed<=30;seed++){const m=simulate(seed,100);assert.equal(m.phase,'finished');assert.equal(m.players.filter(p=>p.hp>0).length,1)}})

test('shared draft retains all original options and records claiming player',()=>{const m=createMatch();draftPool(m);const original=m.draft.originalPool.map(c=>c.uid);const uid=m.draft.pool[0].uid;assign(m,0,uid);assert.equal(m.draft.originalPool.length,6);assert.deepEqual(m.draft.originalPool.map(c=>c.uid),original);assert.equal(m.draft.pool.length,5);assert.equal(m.draft.picks[0].uid,uid);assert.equal(m.draft.picks[0].player,0)});

test('real match lifecycle changes every player spawn corner between rounds',()=>{const m=createMatch();draftPool(m);let previous=null;for(let r=0;r<4&&m.phase!=='finished';r++){autoDraft(m);const battle=beginCombat(m);if(previous)for(let i=0;i<4;i++)assert.notEqual(battle.spawnSlots[i],previous[i]);previous=battle.spawnSlots.slice();for(let t=0;t<900;t++)if(tick(battle,STEP)!==null)break;completeCombat(m,battle)}});

test('timeout ranks surviving teams by damage dealt rather than passive health preservation',()=>{
 const match=createMatch(['bruiser','rogue','ranged','bruiser'],42);
 const battle=spawn(match.players);
 battle.time=30;
 battle.units.forEach(u=>{u.hp=u.maxHp*.8});
 battle.units[0].hp=battle.units[0].maxHp;
 battle.damageDealt=[0,45,20,10];
 const ranking=rankRound(match,battle);
 assert.equal(ranking[0],1);
 assert.equal(ranking[3],0);
});

test('utilities share two passive slots and replacing one removes its effect',()=>{
 const m=createMatch();draftPool(m);const u=m.players[0].squad[0];
 const pick=(key,kind,slot=0)=>{const card={uid:'forced-'+key+'-'+m.draft.turn,kind,key,name:key};m.draft.pool[0]=card;assign(m,m.draft.order[m.draft.turn],card.uid,0,slot)};
 pick('dash','utility');assert.deepEqual(u.passives,['dash']);assert.equal(u.mods.dash,1);
 // Other players' draft turns are used to advance; set the same player's turn for focused equipment tests.
 m.draft.turn=0;m.draft.order=[0,0,0,0];m.phase='draft';
 pick('regen','passive');assert.deepEqual(u.passives,['dash','regen']);
 pick('intercept','utility',0);assert.deepEqual(u.passives,['intercept','regen']);
 assert.equal(u.mods.dash,0);assert.equal(u.mods.intercept,1);
 assert.equal(u.modules.some(x=>x.name==='dash'),false);
});
test('redrafting equipped utility stacks without occupying a new slot',()=>{
 const m=createMatch();draftPool(m);m.draft.order=[0,0,0,0];const u=m.players[0].squad[0];
 const pick=(n)=>{const card={uid:'utility-'+n,kind:'utility',key:'dodge',name:'Dodge'};m.draft.pool[0]=card;assign(m,0,card.uid)};
 pick(1);pick(2);assert.deepEqual(u.passives,['dodge']);assert.equal(u.mods.dodge,2);
});

test('2.9 seeded personalities are stable, seat-distinct, and independent of draft RNG',()=>{
 assert.deepEqual(draftPersonality(42,0),draftPersonality(42,0));
 assert.notDeepEqual(draftPersonality(42,0),draftPersonality(42,1));
 const m=createMatch(undefined,42);draftPool(m);const state=m.random;
 const before=state();const a=draftPersonality(m.seed,2);const after=state();
 const other=createMatch(undefined,42);draftPool(other);assert.equal(other.random(),before);assert.equal(other.random(),after);
 assert.ok(Object.values(a).every(v=>v>=-1&&v<=1));
});
test('2.9 symmetric synergies reward multi-lane and control combinations',()=>{
 const p=createMatch().players[0],u=p.squad[0],c=(key)=>({kind:'attack',key,name:key});
 const baseline=scoreDraft(p,c('piercing'));u.mods.projectiles=2;
 assert.ok(scoreDraft(p,c('piercing'))>baseline);
 const other=scoreDraft(p,c('hazardous'));u.mods.disruption=2;
 assert.ok(scoreDraft(p,c('hazardous'))>other);
 const earlier=scoreDraft(p,c('disruption'));u.mods.hazardous=1;
 assert.ok(scoreDraft(p,c('disruption'))>earlier);
});
test('2.9 Expose and Intercept value nearby allies, without banning solo builds',()=>{
 const p=createMatch().players[0];
 const expose={kind:'attack',key:'expose',name:'Expose'};
 const intercept={kind:'utility',key:'intercept',name:'Intercept'};
 const soloExpose=scoreDraft(p,expose),soloIntercept=scoreDraft(p,intercept);
 p.squad.push(makeChassis('ranged'));
 assert.ok(scoreDraft(p,expose)>soloExpose);
 assert.ok(scoreDraft(p,intercept)>soloIntercept);
 assert.ok(Number.isFinite(soloExpose));
});
test('2.9 target weights affect module evaluation and replacement costs are contextual',()=>{
 const p=createMatch().players[0],u=p.squad[0],card={kind:'attack',key:'burning'};
 const old=scoreDraft(p,card);u.weights.safety+=3;
 assert.ok(scoreDraft(p,card)>old);
 u.passives=['bulwark','dash'];
 const utility={kind:'utility',key:'flank'};
 const replacing=scoreDraft(p,utility,0,0);
 const empty=createMatch().players[0];
 assert.ok(scoreDraft(empty,utility)>replacing);
});
test('2.9 full draft records explainable reasons without breaking chosen card assignment',()=>{
 const m=createMatch(undefined,71);draftPool(m);
 const index=m.draft.order[m.draft.turn],choice=chooseCpuDraft(m,index);
 assert.ok(Number.isFinite(choice.baseScore));
 assert.ok(choice.breakdown.some(x=>x.reason==='Base usefulness'||x.reason==='Another active fighter'));
 const oldSquadSize=m.players[index].squad.length;
 assign(m,index,choice.card.uid,choice.chassisIndex,choice.passiveSlot,choice);
 const pick=m.draft.picks[0];
 assert.equal(pick.uid,choice.card.uid);
 assert.equal(pick.reasoning.baseScore,choice.baseScore);
 assert.deepEqual(pick.reasoning.reasons,choice.reasons);
 assert.ok(m.players[index].squad.length>=oldSquadSize);
});

test('3.1.2 draft valuation reduces unconditional premium while preserving piercing synergy',()=>{
 for(const type of ['bruiser','rogue','ranged']){
  const p=createMatch([type,'rogue','ranged','bruiser'],42).players[0];
  p.squad.push(makeChassis('ranged'));
  const card=(kind,key)=>({kind,key});
  assert.equal(scoreDraft(p,card('attack','followthrough')),type==='rogue'?18:16);
  assert.equal(scoreDraft(p,card('attack','piercing')),16);
  assert.equal(scoreDraft(p,card('utility','coordinated')),22);
  p.squad[0].mods.projectiles=2;
  assert.ok(scoreDraft(p,card('attack','piercing'))>16);
 }
});
