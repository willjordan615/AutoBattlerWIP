// Personality testing only. Identical matched game fixtures; no production rules.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {ARENAS,STEP,makeChassis,spawn,spawnSlots,tick,stats,distance,clearLine,placementGroups} from '../src/simulation.js';
import {TARGET_MODULES} from '../src/engine/module-registry.js?v=engine-340-r1';

export const TYPES=['bruiser','rogue','ranged'];
export const CONDITIONS=['control','threat-position','position-engagement-mid','position-safety-pressure'];
export const PROFILES=[
 {name:'baseline'},
 {name:'safety-zero',key:'safety',zero:true},
 ...['coward','aggressor','duelist'].flatMap(card=>[1,3].map(n=>({name:Object.keys(TARGET_MODULES[card])[0]+'+'+n,card,n}))),
 ...[1,3].map(n=>({name:'threat+'+n,key:'threat',n})),
 {name:'protection+2',card:'guardian',n:2},
 {name:'preferredRange+2',card:'skirmisher',n:2}
];
export function applyProfile(chassis,profile){
 if(profile.zero)chassis.weights[profile.key]=0;
 else if(profile.card)for(const [k,v] of Object.entries(TARGET_MODULES[profile.card]))chassis.weights[k]+=v*profile.n;
 else if(profile.key)chassis.weights[profile.key]+=profile.n;
 // Diagnostic-only raw stat increments; not draft offers.
 for(const [k,v] of Object.entries(profile.statMods||{})){
  assert.ok(['hp','damage','speed','rate','range'].includes(k)&&Number.isFinite(v)&&v>=0);
  chassis.mods[k]+=v;
 }
 return chassis;
}
export function focalSeats(seed){
 const slots=spawnSlots(seed+37);
 const corner=seed%4;
 return [slots.indexOf(corner),slots.indexOf((corner+2)%4)];
}
export function makeFixture({seed,arena,type,owner,health,profile,condition,layout='mirror'}){
 const ally=TYPES[(TYPES.indexOf(type)+1)%TYPES.length];
 const players=Array.from({length:4},(_,i)=>({name:'P'+i,hp:100,streak:0,squad:[makeChassis(type),makeChassis(ally)]}));
 if(layout==='mixed'){
  // Relative seats rotate with focal owner; matched variants keep all opponents fixed.
  players[(owner+1)%4].squad=[makeChassis(TYPES[(seed+1)%3])];
  players[(owner+2)%4].squad=[makeChassis(TYPES[seed%3]),makeChassis(TYPES[(seed+1)%3]),makeChassis(TYPES[(seed+2)%3])];
  players[(owner+3)%4].squad=[makeChassis(TYPES[(seed+2)%3]),makeChassis(TYPES[seed%3])];
 }
 applyProfile(players[owner].squad[0],profile);
 const b=spawn(players,arena,seed);
 const focal=b.units.find(u=>u.owner===owner&&u.id%100===0);
 // All four same-slot units start at the same health; only focal weights vary.
 for(const u of b.units)if(u.id%100===0)u.hp=u.maxHp*health;
 b.aiExperiment=condition;
 b.decisionAudit={interval:30,limit:1,units:{}};
 b.diagnostics={units:{}};
 return {b,focal};
}
const add=(o,k,n=1)=>{o[k]=(o[k]||0)+n};
function observe(b,u,m){
 if(u.hp<=0)return;
 const enemies=b.units.filter(e=>e.hp>0&&e.owner!==u.owner);
 if(!enemies.length)return;
 const allies=b.units.filter(a=>a.hp>0&&a.owner===u.owner&&a.id!==u.id);
 const st=stats(u),selected=enemies.find(e=>e.id===u.focus);
 const visible=enemies.filter(e=>clearLine(u,e,b.arena));
 const access=visible.filter(e=>distance(u,e)<=st.range);
 const pressure=visible.filter(e=>distance(u,e)<=stats(e).range);
 const focused=pressure.filter(e=>e.focus===u.id);
 add(m,'frames');if(pressure.length)add(m,'exposed');
 if(access.length){add(m,'access');if(!pressure.length)add(m,'safeAccess');}
 if(focused.length){add(m,'focused');if(focused.includes(selected))add(m,'focusedSelected');}
 if(u.hp/u.maxHp<.35){add(m,'low');if(pressure.length)add(m,'lowExposed');}
 if(allies.length){add(m,'allyFrames');add(m,'allyDistance',Math.min(...allies.map(a=>distance(u,a))));}
 const threateningAlly=enemies.filter(e=>allies.some(a=>e.focus===a.id));
 if(threateningAlly.length){add(m,'allyThreatFrames');if(threateningAlly.includes(selected))add(m,'allyThreatSelected');}
 if(selected){
  if(enemies.some(e=>!enemies.some(a=>a.owner===e.owner&&a!==e))&&enemies.some(e=>enemies.some(a=>a.owner===e.owner&&a!==e))){
   add(m,'mixedIsolationFrames');
   if(!enemies.some(a=>a.owner===selected.owner&&a!==selected))add(m,'singletonSelected');
  }
  add(m,'targetFrames');add(m,'rangeRatio',distance(u,selected)/st.range);
  add(m,'rangeError',Math.abs(distance(u,selected)/st.range-.85));
  const peers=enemies.filter(e=>e.owner===selected.owner&&e!==selected);
  if(peers.length){add(m,'isolationFrames');add(m,'isolationDistance',Math.min(...peers.map(e=>distance(selected,e))));}
 }
}
const ratio=(n,d)=>d?n/d:null;
export function summarizeObservation(m,c,u,b){
 const groups=placementGroups(b);
 const rank=1+groups.slice(0,groups.findIndex(g=>g.includes(u.owner))).reduce((n,g)=>n+g.length,0);
 const fraction=(n,d)=>ratio(m[n]||0,m[d]||0);
 return {frames:m.frames||0,survived:Number(u.hp>0),hp:u.hp/u.maxHp,rank,damage:u.combatStats.damage,taken:u.combatStats.damageTaken,
  releases:u.combatStats.attacks,exposure:fraction('exposed','frames'),lowExposure:fraction('lowExposed','low'),
  safeAccess:fraction('safeAccess','frames'),access:fraction('access','frames'),focusedSelection:fraction('focusedSelected','focused'),
  allyThreatSelection:fraction('allyThreatSelected','allyThreatFrames'),allyDistance:fraction('allyDistance','allyFrames'),
  singletonSelection:fraction('singletonSelected','mixedIsolationFrames'),isolationDistance:fraction('isolationDistance','isolationFrames'),rangeRatio:fraction('rangeRatio','targetFrames'),rangeError:fraction('rangeError','targetFrames'),
  missedAccess:ratio(c.alternateAccessOnly||0,c.anyAccess||0),hold:ratio(c['mode:hold']||0,c.actionFrames||0),
  support:ratio(c['mode:support']||0,c.actionFrames||0),switches:ratio((c.actionSwitches||0)*1000,c.actionFrames||0),
  releasesPerSecond:ratio(u.combatStats.attacks*30,m.frames||0),timeout:Number(b.time>=30-1e-6),
  stall:Number((b.diagnostics.units[u.id]?.maxPursuitStallFrames||0)>=90)};
}
export function runFixture(spec){
 const {b,focal}=makeFixture(spec),m={};
 let ended=null;
 for(let i=0;i<900;i++){
  ended=tick(b,STEP);observe(b,focal,m);
  if(ended!==null)break;
 }
 assert.notEqual(ended,null,'round incomplete');
 return summarizeObservation(m,b.decisionAudit.units[focal.id]?.counts||{},focal,b);
}
// Mean paired delta uses only pairs where both denominators exist, not pooled
// frames. Retain n and direction counts to show consistency and missingness.
export function pairedSummary(rows){
 const out={};
 for(const r of rows){
  const dest=out[r.profile]||={pairs:0,metrics:{}};dest.pairs++;
  for(const [k,v] of Object.entries(r.result)){
   const base=r.baseline[k];
   if(!Number.isFinite(v)||!Number.isFinite(base))continue;
   const x=dest.metrics[k]||={n:0,base:0,value:0,delta:0,up:0,down:0,tie:0};
   const d=v-base;
   x.n++;x.base+=base;x.value+=v;x.delta+=d;
   x[d>1e-9?'up':d< -1e-9?'down':'tie']++;
  }
 }
 for(const p of Object.values(out))for(const x of Object.values(p.metrics))for(const k of ['base','value','delta'])x[k]/=x.n;
 return out;
}
export function runPersonality({condition,type,start=5,count=2}){
 assert.ok(CONDITIONS.includes(condition)&&TYPES.includes(type));
 assert.ok(Number.isInteger(start)&&Number.isInteger(count)&&count>0&&count<=20);
 const rows=[];
 for(let seed=start;seed<start+count;seed++)for(const arena of ARENAS)for(const owner of focalSeats(seed))for(const health of [1,.3]){
  const spec={seed,arena,type,owner,health,condition};
  const baseline=runFixture({...spec,profile:PROFILES[0]});
  for(const profile of PROFILES.slice(1)){
   const result=runFixture({...spec,profile});
   rows.push({seed,arena:arena.name,owner,health,profile:profile.name,result,baseline});
  }
 }
 const baselines=rows.length/(PROFILES.length-1);
 const summary={condition,type,start,count,rounds:baselines*PROFILES.length,pairs:rows.length,all:pairedSummary(rows),
  full:pairedSummary(rows.filter(r=>r.health===1)),low:pairedSummary(rows.filter(r=>r.health===.3))};
 return {summary,rows};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=runPersonality({condition:process.argv[2]||'control',type:process.argv[3]||'ranged',start:Number(process.argv[4]||5),count:Number(process.argv[5]||2)});
 console.log(JSON.stringify(report));
}
