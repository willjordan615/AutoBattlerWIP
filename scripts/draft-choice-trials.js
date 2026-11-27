// Offline counterfactuals from genuine draft states. Last picker only:
 // all other players have already chosen, so their squads remain identical.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createMatch,draftPool,assign,beginCombat,completeCombat,rankRound,legal,canEquip} from '../src/headless.js';
import {ARENAS,STEP,spawn,tick,resolvePlayerHP} from '../src/simulation.js';
import {startingTypes} from './draft-intelligence-audit.js';
import {chooseCpuDraft,draftEvaluator,draftPersonality,draftContext} from '../src/draft-ai.js';
import {projectDraft,coherenceDelta} from '../src/draft-coherence.js';
import {empiricalFeatures,rosterFeatures} from '../src/draft-empirical.js';
export function choices(match,seat){
 const p=match.players[seat],ctx=draftContext(match,seat),prefs=draftPersonality(match.seed,seat),out=[],seen=new Set();
 for(const card of match.draft.pool)if(legal(p,card)){
  for(let slot=0;slot<(card.kind==='unit'?1:p.squad.length);slot++){
   if(card.kind!=='unit'&&!canEquip(p.squad[slot],card))continue;
   const slots=['utility','passive'].includes(card.kind)&&p.squad[slot].passives.length>=2?2:1;
   for(let ps=0;ps<slots;ps++){
    const signature=card.kind+':'+card.key+'@'+slot+':'+(card.kind==='utility'&&p.squad[slot].passives.includes(card.key)?'upgrade':ps);
    if(seen.has(signature))continue;seen.add(signature);
    const args=[p,card,slot,ps,prefs,ctx];
    out.push({card,slot,ps,signature,profile:draftEvaluator('candidate')(...args).score,
     personalityTilt:draftEvaluator('candidate')(...args).score-draftEvaluator('candidate')(p,card,slot,ps,{},ctx).score,
     coherent:draftEvaluator('coherent')(...args).score,coherence:coherenceDelta(p,card,slot,ps,ctx).delta,
     empirical:draftEvaluator('empirical')(...args).score});
   }
  }
 }
 return out;
}
export function trial(match,seat,option,variant=0){
 // Clone all public roster state; do not mutate the source match.
 const players=structuredClone(match.players);
 if(option)players[seat]=projectDraft(players[seat],option.card,option.slot,option.ps);
 const round=match.round,seed=match.seed+round*991+variant*104729;
 const arena=ARENAS[(round-1+variant)%ARENAS.length];
 const b=spawn(players,arena,seed,round,match.lastSpawnSlots);
 let end=null;for(let t=0;t<900;t++){end=tick(b,STEP);if(end!==null)break;}
 assert.notEqual(end,null);
 const ranking=rankRound({...match,players,seed:match.seed+variant*104729},b);
 const rank=ranking.indexOf(seat)+1;
 const before=players[seat].hp;
 resolvePlayerHP(players,ranking,round);
 return {rank,utility:1-(rank-1)/Math.max(1,ranking.length-1),loss:before-players[seat].hp,
  timeout:b.time>=30-1e-6,damage:b.damageDealt[seat]||0};
}
const avg=(a,k)=>a.reduce((n,x)=>n+x[k],0)/a.length;
export function sampleBoard(match,seat,variants=2){
 assert.equal(match.draft.turn,match.draft.order.length-1);
 const p=match.players[seat],ctx=draftContext(match,seat),before=rosterFeatures(p,ctx),opts=choices(match,seat);
 const baseline=Array.from({length:variants},(_,v)=>trial(match,seat,null,v));
 const rows=opts.map(o=>{
  const outcomes=Array.from({length:variants},(_,v)=>trial(match,seat,o,v));
  return {...o,features:empiricalFeatures(p,o.card,o.slot,o.ps,ctx,before),
   utility:avg(outcomes,'utility'),delta:avg(outcomes,'utility')-avg(baseline,'utility'),
   hpSaved:avg(baseline,'loss')-avg(outcomes,'loss'),outcomes};
 });
 return {seed:match.seed,round:match.round,seat,size:p.squad.length,opponents:ctx.opponents,
  sourcePolicy:match.seed%2?'candidate':'coherent',baseline,options:rows};
}
export function collect({seed=5101,count=8,variants=2}={}){
 const boards=[];let sourceRounds=0;
 for(let i=0;i<count;i++){
  const s=seed+i,m=createMatch(startingTypes(s),s),policy=s%2?'candidate':'coherent';
  draftPool(m);
  while(m.phase!=='finished'&&m.round<=250){
   while(m.phase==='draft'){
    const seat=m.draft.order[m.draft.turn];
    // Every other round, alternate parity by seed. Retain all legal options,
    // not merely those favored by the proposed model.
    if(m.draft.turn===m.draft.order.length-1&&(m.round+s)%2===0)boards.push(sampleBoard(m,seat,variants));
    const choice=chooseCpuDraft(m,seat,{policy});
    assign(m,seat,choice.card.uid,choice.chassisIndex,choice.passiveSlot,choice);
   }
   const b=beginCombat(m);let end=null;for(let t=0;t<900;t++){end=tick(b,STEP);if(end!==null)break;}
   assert.notEqual(end,null);completeCombat(m,b);sourceRounds++;
  }
  assert.equal(m.phase,'finished');
 }
 return {seed,count,variants,sourceRounds,boards};
}
export function auditBoards(boards){
 const result={boards:boards.length,options:0,simulations:0,disagreements:0,profileWins:0,coherentWins:0,ties:0,
  profileUtility:0,coherentUtility:0,empiricalUtility:0,oracleUtility:0,profileHpSaved:0,coherentHpSaved:0,empiricalHpSaved:0,
  disputedCards:{},byPhase:{},byCard:{}};
 const top=(opts,k)=>opts.reduce((a,b)=>b[k]>a[k]?b:a);
 for(const b of boards){
  const o=b.options,p=top(o,'profile'),c=top(o,'coherent'),e=top(o,'empirical'),best=top(o,'utility');
  result.options+=o.length;result.simulations+=b.baseline.length+o.reduce((n,x)=>n+x.outcomes.length,0);
  for(const [k,x] of [['profile',p],['coherent',c],['empirical',e]]){result[k+'Utility']+=x.utility;result[k+'HpSaved']+=x.hpSaved;}
  result.oracleUtility+=best.utility;
  for(const x of o){const k=x.card.kind+':'+x.card.key,r=result.byCard[k]||={n:0,delta:0,hpSaved:0};r.n++;r.delta+=x.delta;r.hpSaved+=x.hpSaved;}
  if(p.signature!==c.signature){
   result.disagreements++;const diff=c.utility-p.utility;
   if(diff>1e-8)result.coherentWins++;else if(diff< -1e-8)result.profileWins++;else result.ties++;
   const k=c.card.kind+':'+c.card.key+' over '+p.card.kind+':'+p.card.key,r=result.disputedCards[k]||={n:0,delta:0,hpSaved:0};r.n++;r.delta+=diff;r.hpSaved+=c.hpSaved-p.hpSaved;
   const phase=b.round<=4?'early':b.round<=8?'middle':'late',q=result.byPhase[phase]||={n:0,delta:0};q.n++;q.delta+=diff;
  }
 }
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const r=collect({seed:Number(process.argv[2]||5101),count:Number(process.argv[3]||8),variants:Number(process.argv[4]||2)});
 console.log(JSON.stringify(r));
}
