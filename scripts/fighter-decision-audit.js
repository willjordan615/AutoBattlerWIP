// Opt-in first-pass fighter audit. No draft/module/stat changes.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {ARENAS,STEP,makeChassis,spawn,tick} from '../src/simulation.js';
import {createMatch,draftPool,assign,beginCombat,completeCombat} from '../src/headless.js';
import {chooseCpuDraft} from '../src/draft-ai.js';

const types=['bruiser','rogue','ranged'];
const snapshot=b=>JSON.stringify(b,(k,v)=>k==='decisionAudit'||k==='diagnostics'?undefined:v instanceof Set?[...v]:v instanceof Map?[...v]:v);
function compareRound(a,b){
 b.decisionAudit={interval:15,limit:128,units:{}};
 b.diagnostics={units:{}};
 let x=null,y=null;
 for(let frame=0;frame<900;frame++){
  x=tick(a,STEP);y=tick(b,STEP);
  if(frame%30===0||x!==null||y!==null){
   assert.deepEqual(x,y);assert.equal(snapshot(a),snapshot(b),'telemetry changed state at tick '+b.tick);
  }
  if(x!==null||y!==null)break;
 }
 assert.notEqual(y,null,'round incomplete');
 assert.equal(snapshot(a),snapshot(b));
 return {ticks:b.tick,timeout:b.time>=30-1e-6,alive:y,units:b.decisionAudit.units,
  navigation:Object.fromEntries(Object.entries(b.diagnostics.units).map(([id,r])=>[id,{
   frames:r.frames,stuck:r.stuck,collisionLoss:r.collisionLoss,maxPursuitStallFrames:r.maxPursuitStallFrames||0,
   shots:r.shots,damage:r.damage,holdWithAttackAccess:r.holdWithAttackAccess||0
  }]))};
}
function fixture(seed,arena,size){
 const p=Array.from({length:4},(_,owner)=>({name:'P'+owner,hp:100,streak:0,
  squad:Array.from({length:size},(_,i)=>makeChassis(types[(owner+i+seed)%3]))}));
 return spawn(p,arena,seed);
}
export function runDecisionAudit({seeds=2,seed=1,matches=1}={}){
 assert.ok(Number.isInteger(seeds)&&seeds>=1&&seeds<=20);
 assert.ok(Number.isInteger(seed)&&seed>=0);
 assert.ok(Number.isInteger(matches)&&matches>=0&&matches<=10);
 const rounds=[],matchReports=[];
 for(let s=seed;s<seed+seeds;s++)for(const arena of ARENAS)for(const size of [1,2,3]){
  rounds.push({seed:s,arena:arena.name,size,...compareRound(fixture(s,arena,size),fixture(s,arena,size))});
 }
 for(let s=seed;s<seed+matches;s++){
  const a=createMatch(undefined,s),b=createMatch(undefined,s);draftPool(a);draftPool(b);
  const matchRounds=[];
  const draft=m=>{while(m.phase==='draft'){const i=m.draft.order[m.draft.turn],c=chooseCpuDraft(m,i);assign(m,i,c.card.uid,c.chassisIndex,c.passiveSlot);}};
  for(let i=0;i<250&&a.phase!=='finished';i++){
   draft(a);draft(b);
   const x=beginCombat(a),y=beginCombat(b);
   const report=compareRound(x,y);
   assert.deepEqual(completeCombat(a,x),completeCombat(b,y));
   assert.equal(snapshot(a),snapshot(b));
   matchRounds.push({round:i+1,arena:y.arena.name,...report});
  }
  assert.equal(a.phase,'finished');assert.equal(b.phase,'finished');
  matchReports.push({seed:s,rounds:matchRounds});
 }
 const byChassis={};
 for(const r of [...rounds,...matchReports.flatMap(m=>m.rounds)])for(const u of Object.values(r.units)){
  const out=byChassis[u.type]||={};
  for(const [k,v] of Object.entries(u.counts))out[k]=(out[k]||0)+v;
 }
 return {config:{seeds,seed,matches},parity:true,fixtureRounds:rounds.length,
  matchRounds:matchReports.reduce((n,m)=>n+m.rounds.length,0),byChassis,rounds,matchReports};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=runDecisionAudit({seeds:Number(process.argv[2]||2),seed:Number(process.argv[3]||1),matches:Number(process.argv[4]??1)});
 if(process.argv.includes('--json'))console.log(JSON.stringify(report));
 else console.log(JSON.stringify({config:report.config,parity:report.parity,fixtureRounds:report.fixtureRounds,
  matchRounds:report.matchRounds,byChassis:report.byChassis,fixtureTimeouts:report.rounds.filter(r=>r.timeout).length,
  matchTimeouts:report.matchReports.flatMap(m=>m.rounds).filter(r=>r.timeout).length},null,2));
}
