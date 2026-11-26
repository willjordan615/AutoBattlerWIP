// 3.3 feature experiments, isolated arms with matched input strata.
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {ARENAS,STEP,makeChassis,spawn,tick,placementGroups,teamPercent,stats,clearLine,distance} from '../src/simulation.js';
import {createMatch,draftPool,assign,beginCombat,completeCombat} from '../src/headless.js';
import {chooseCpuDraft} from '../src/draft-ai.js';

import {EVALUATION_ARMS} from '../src/engine/targeting.js?v=engine-323-r1';
const types=['bruiser','rogue','ranged'];
const condition=process.argv[2]||'control',start=Number(process.argv[3]||1),count=Number(process.argv[4]||2);
assert.ok(['control','safety','engagement','threat','threat-v2','threat-target','threat-position',...Object.keys(EVALUATION_ARMS)].includes(condition));
assert.ok(Number.isInteger(start)&&Number.isInteger(count)&&count>0&&count<=20);
const add=(o,k,n=1)=>{o[k]=(o[k]||0)+n;};
function run(b){
 b.aiExperiment=condition;
 b.decisionAudit={interval:30,limit:1,units:{}};
 b.diagnostics={units:{}};
 const observations={};
 const initialHp=Object.fromEntries(b.units.map(u=>[u.id,u.hp/u.maxHp]));
 let ended=null,ms=0;
 for(let t=0;t<900;t++){
  const before=performance.now();ended=tick(b,STEP);ms+=performance.now()-before;
  for(const u of b.units){
   if(u.hp<=0)continue;
   const row=observations[u.id]||={frames:0};
   const enemies=b.units.filter(e=>e.hp>0&&e.owner!==u.owner),target=enemies.find(e=>e.id===u.focus),st=stats(u);
   if(!enemies.length)continue;
   const access=enemies.some(e=>distance(u,e)<=st.range&&clearLine(u,e,b.arena));
   const immediate=enemies.filter(e=>distance(u,e)<=stats(e).range&&clearLine(u,e,b.arena));
   const exposed=immediate.length>0;
   const focused=immediate.some(e=>e.focus===u.id);
   if(exposed)add(row,'immediatePressureFrames');
   if(focused)add(row,'focusedPressureFrames');
   if(focused&&target&&immediate.some(e=>e.focus===u.id&&e.id===target.id))add(row,'focusedPressureSelected');
   if(exposed&&target&&immediate.some(e=>e.id===target.id))add(row,'immediatePressureSelected');
   add(row,'frames');if(exposed)add(row,'exposed');
   if(u.hp/u.maxHp<.35){add(row,'lowHealthFrames');if(exposed)add(row,'lowHealthExposed');}
   if(access)add(row,'postTickAccess');
   if(target){add(row,'targetSamples');add(row,'rangeRatioSum',distance(u,target)/st.range);}
  }
  if(ended!==null)break;
 }
 assert.notEqual(ended,null,'round incomplete');
 const groups=placementGroups(b);
 const byChassis={},byPreference={};
 for(const u of b.units){
  const out={};
  add(out,'appearances');add(out,'survivors',Number(u.hp>0));add(out,'hpFraction',u.hp/u.maxHp);
  add(out,'damage',u.combatStats.damage);add(out,'damageTaken',u.combatStats.damageTaken);
  add(out,'releases',u.combatStats.attacks);
  for(const [k,v] of Object.entries(b.decisionAudit.units[u.id]?.counts||{}))add(out,k,v);
  for(const [k,v] of Object.entries(observations[u.id]||{}))add(out,k,v);
  const nav=b.diagnostics.units[u.id]||{};
  add(out,'recoveries',nav.stuck||0);add(out,'stall3s',Number((nav.maxPursuitStallFrames||0)>=90));
  const group=byChassis[u.type]||={};
  const label=[u.owner,u.type,initialHp[u.id]<.35?'low':'full'].join(':');
  const pref=byPreference[label]||={};
  for(const [k,v] of Object.entries(out)){add(group,k,v);add(pref,k,v);}
 }
 return {ticks:b.tick,timeout:b.time>=30-1e-6,ms,groups,byChassis,byPreference,teams:b.players.map((p,owner)=>({owner,hp:teamPercent(b,owner)}))};
}
function fixture(seed,arena,size,profile){
 const p=Array.from({length:4},(_,owner)=>({name:'P'+owner,hp:100,streak:0,
  squad:Array.from({length:size},(_,i)=>makeChassis(types[(owner+i+seed)%3]))}));
 if(profile==='preferences')for(const [i,p0] of p.entries())for(const u of p0.squad){
  if(i===0)u.weights.safety=0;
  if(i===1)u.weights.safety+=2;
  if(i===2)u.weights.damage+=2;
  if(i===3)u.weights.threat+=2;
 }
 const b=spawn(p,arena,seed);
 if(profile==='preferences')for(const u of b.units)if((u.owner+u.id%100)%2===0)u.hp=u.maxHp*.30;
 return b;
}
const fixtures=[],matches=[];
for(let seed=start;seed<start+count;seed++){
 for(const arena of ARENAS)for(const size of [1,2,3])for(const profile of ['default','preferences']){
  fixtures.push({seed,arena:arena.name,size,profile,...run(fixture(seed,arena,size,profile))});
 }
 const m=createMatch(undefined,seed);draftPool(m);const rounds=[];
 while(m.phase!=='finished'&&rounds.length<250){
  while(m.phase==='draft'){const i=m.draft.order[m.draft.turn],c=chooseCpuDraft(m,i);assign(m,i,c.card.uid,c.chassisIndex,c.passiveSlot);}
  const b=beginCombat(m);rounds.push({round:m.round,arena:b.arena.name,...run(b)});completeCombat(m,b);
 }
 assert.equal(m.phase,'finished');
 matches.push({seed,winner:m.players.findIndex(p=>p.hp>0),rounds});
}
function summarize(rows){
 const byChassis={};
 for(const r of rows)for(const [type,counts] of Object.entries(r.byChassis)){
  const dest=byChassis[type]||={};
  for(const [key,n] of Object.entries(counts))add(dest,key,n);
 }
 return {rounds:rows.length,timeouts:rows.filter(r=>r.timeout).length,byChassis,ticks:rows.reduce((s,r)=>s+r.ticks,0),ms:rows.reduce((s,r)=>s+r.ms,0)};
}
const summary={condition,start,count,default:summarize(fixtures.filter(r=>r.profile==='default')),preferences:summarize(fixtures.filter(r=>r.profile==='preferences')),matches:summarize(matches.flatMap(m=>m.rounds)),winners:matches.map(m=>({seed:m.seed,winner:m.winner}))};
const preferenceBreakdown={};
for(const r of fixtures.filter(r=>r.profile==='preferences'))for(const [label,counts] of Object.entries(r.byPreference)){
 const dest=preferenceBreakdown[label]||={};
 for(const [key,n] of Object.entries(counts))add(dest,key,n);
}
console.log(JSON.stringify({summary,preferenceBreakdown,fixtures,matches}));
