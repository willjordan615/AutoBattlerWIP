// Head-to-head policy comparison using the unchanged 3.3 engine and actual shared draft.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createMatch,draftPool,assign,beginCombat,completeCombat,legal,canEquip} from '../src/headless.js';
import {CHASSIS,tick,STEP,makeChassis} from '../src/simulation.js';
import {chooseCpuDraft,draftPersonality,draftContext,evaluateDraft,evaluateDraftLegacy,TRAITS} from '../src/draft-ai.js';
const TYPES=Object.keys(CHASSIS),POLICIES=['legacy','candidate'];
const inc=(o,k,n=1)=>o[k]=(o[k]||0)+n;
const safe=(n,d)=>d?n/d:null;
const mean=xs=>safe(xs.reduce((s,x)=>s+x,0),xs.length);
const jaccard=(a,b)=>{const x=new Set(a),y=new Set(b),union=new Set([...x,...y]);return union.size?1-[...x].filter(k=>y.has(k)).length/union.size:0};
export function allocations(seed){
 const other=1+seed%3;
 const a=Array.from({length:4},(_,i)=>i===0||i===other?'candidate':'legacy');
 return [
  {mode:'mixed-a',policies:a},
  {mode:'mixed-b',policies:a.map(x=>x==='candidate'?'legacy':'candidate')},
  {mode:'all-legacy',policies:Array(4).fill('legacy')},
  {mode:'all-candidate',policies:Array(4).fill('candidate')}
 ];
}
export function startingTypes(seed){
 const initial=[...TYPES,TYPES[seed%3]],offset=seed%4;
 return initial.map((_,i)=>initial[(i+offset)%4]);
}
export function runMatch(seed,{mode,policies}){
 const types=startingTypes(seed),match=createMatch(types,seed),picks=Array.from({length:4},()=>[]),rounds=[];
 draftPool(match);
 while(match.phase!=='finished'&&match.round<=250){
  while(match.phase==='draft'){
   const seat=match.draft.order[match.draft.turn],player=match.players[seat],policy=policies[seat];
   const choice=chooseCpuDraft(match,seat,{policy});
   const {card,chassisIndex,passiveSlot}=choice,u=player.squad[chassisIndex];
   const old=u?.passives.length>=2?u.passives[passiveSlot]:null;
   const replacing=(card.kind==='passive'||card.kind==='utility')&&old&&old!==card.key&&!(card.kind==='utility'&&u.passives.includes(card.key));
   const neutral=(policy==='legacy'?evaluateDraftLegacy:evaluateDraft)(player,card,chassisIndex,passiveSlot,{},draftContext(match,seat)).score;
   picks[seat].push({round:match.round,kind:card.kind,key:card.key,slot:chassisIndex,type:card.kind==='unit'?card.key:u.type,
    score:choice.baseScore,personalityContribution:choice.baseScore-neutral,replaced:replacing?old:null,
    reasons:choice.reasons,breakdown:choice.breakdown});
   assign(match,seat,card.uid,chassisIndex,passiveSlot,choice);
  }
  const battle=beginCombat(match);let end=null;
  for(let i=0;i<900;i++){end=tick(battle,STEP);if(end!==null)break;}
  assert.notEqual(end,null,'combat did not complete');
  const result=completeCombat(match,battle);
  rounds.push({round:result.round,ranking:result.ranking,remaining:result.remaining,timeout:result.time>=30-1e-6,time:result.time});
 }
 assert.equal(match.phase,'finished');
 const winner=match.players.findIndex(p=>p.hp>0);
 const eliminated=match.players.map((p,i)=>({i,death:rounds.findIndex(r=>r.remaining[i]===0)})).filter(x=>x.i!==winner).sort((a,b)=>b.death-a.death||a.i-b.i);
 const finalOrder=[winner,...eliminated.map(x=>x.i)];
 const seats=match.players.map((p,i)=>({seat:i,policy:policies[i],starting:types[i],personality:draftPersonality(seed,i),rank:finalOrder.indexOf(i)+1,
  won:i===winner,roster:p.squad.map(u=>({type:u.type,mods:u.mods,weights:u.weights,passives:u.passives})),picks:picks[i]}));
 return {seed,mode,winner,rounds,seats};
}
function groupMetrics(seats){
 const all=seats.flatMap(s=>s.picks),counts={},categories={},starts={},finalSizes={},firstRecruit=[],thirdRecruit=[];
 for(const s of seats){
  const a=starts[s.starting]||={players:0,wins:0,rankSum:0};a.players++;a.wins+=Number(s.won);a.rankSum+=s.rank;
  inc(finalSizes,String(s.roster.length));
  const rec=s.picks.filter(p=>p.kind==='unit');
  if(rec[0])firstRecruit.push(rec[0].round);
  if(rec[1])thirdRecruit.push(rec[1].round);
 }
 for(const p of all){inc(counts,p.kind+':'+p.key);inc(categories,p.kind);}
 const entropy=-Object.values(counts).reduce((n,x)=>{const p=x/Math.max(1,all.length);return n+p*Math.log2(p)},0);
 return {players:seats.length,wins:seats.filter(s=>s.won).length,rankSum:seats.reduce((n,s)=>n+s.rank,0),picks:all.length,
  moduleCounts:counts,categories,starts,finalSizes,firstRecruit:{n:firstRecruit.length,sum:firstRecruit.reduce((n,x)=>n+x,0)},
  thirdRecruit:{n:thirdRecruit.length,sum:thirdRecruit.reduce((n,x)=>n+x,0)},replacements:all.filter(p=>p.replaced).length,
  personalitySum:all.reduce((n,p)=>n+p.personalityContribution,0),entropy,
  distinctPerPlayerSum:seats.reduce((n,s)=>n+new Set(s.picks.filter(p=>p.kind!=='unit').map(p=>p.kind+':'+p.key)).size,0)};
}
function summarize(games){
 const groups={};
 for(const mode of ['mixed','all-legacy','all-candidate']){
  const ms=games.filter(g=>mode==='mixed'?g.mode.startsWith('mixed'):g.mode===mode);
  const seats=ms.flatMap(g=>g.seats),metrics={};
  for(const p of POLICIES)metrics[p]=groupMetrics(seats.filter(s=>s.policy===p));
  const diversity=ms.flatMap(g=>g.seats.flatMap((s,i)=>g.seats.slice(i+1).map(t=>jaccard(s.picks.filter(p=>p.kind!=='unit').map(p=>p.kind+':'+p.key),t.picks.filter(p=>p.kind!=='unit').map(p=>p.kind+':'+p.key)))));
  const allRounds=ms.flatMap(g=>g.rounds);
  groups[mode]={matches:ms.length,rounds:allRounds.length,timeouts:allRounds.filter(r=>r.timeout).length,
   diversitySum:diversity.reduce((n,x)=>n+x,0),diversityPairs:diversity.length,policies:metrics};
 }
 return groups;
}
// Same legal offer pool, same chassis and weights, no RNG for scoring.
export function profileProbe(seed,count){
 const results={};
 for(const policy of POLICIES){
  const evaluate=policy==='legacy'?evaluateDraftLegacy:evaluateDraft;
  const metrics=results[policy]={fixtures:0,traitComparisons:0,changedChoices:0,changedCard:0,distinctSum:0,byTrait:{}};
  for(let i=0;i<count;i++)for(const type of TYPES)for(const size of [1,2,3]){
   const m=createMatch([type,'bruiser','rogue','ranged'],seed+i);
   while(m.players[0].squad.length<size)m.players[0].squad.push(makeChassis(TYPES[(TYPES.indexOf(type)+m.players[0].squad.length)%3]));
   if(size>1){const u=m.players[0].squad[0];u.passives=['dash','regen'];u.mods.dash=1;u.mods.burning=1;u.modules=[{kind:'attack',name:'Burning'}];}
   draftPool(m);const p=m.players[0],ctx=draftContext(m,0);
   const options=m.draft.pool.flatMap(card=>!legal(p,card)?[]:Array.from({length:card.kind==='unit'?1:p.squad.length},(_,slot)=>slot).flatMap(slot=>{
    if(card.kind!=='unit'&&!canEquip(p.squad[slot],card))return [];
    const n=['utility','passive'].includes(card.kind)&&p.squad[slot].passives.length>=2?2:1;
    return Array.from({length:n},(_,passiveSlot)=>({card,slot,passiveSlot}));
   }));
   const best=prefs=>options.map(o=>({...o,score:evaluate(p,o.card,o.slot,o.passiveSlot,prefs,ctx).score})).reduce((a,b)=>b.score>a.score?b:a);
   const signature=o=>o.card.kind+':'+o.card.key+'@'+o.slot+':'+o.passiveSlot;
   const selected=new Set([signature(best({}))]);
   metrics.fixtures++;
   for(const trait of TRAITS){
    const a=best({[trait]:-1}),b=best({[trait]:1});
    const changed=Number(signature(a)!==signature(b)),cardChanged=Number(a.card.key!==b.card.key||a.card.kind!==b.card.kind);
    metrics.traitComparisons++;metrics.changedChoices+=changed;metrics.changedCard+=cardChanged;
    const r=metrics.byTrait[trait]||={n:0,changed:0,cardChanged:0};r.n++;r.changed+=changed;r.cardChanged+=cardChanged;
    selected.add(signature(a));selected.add(signature(b));
   }
   metrics.distinctSum+=selected.size;
  }
 }
 return results;
}
export function runAudit({seed=4101,count=8}={}){
 assert.ok(Number.isInteger(seed)&&Number.isInteger(count)&&count>0&&count<=30);
 const games=[];
 for(let i=0;i<count;i++)for(const spec of allocations(seed+i))games.push(runMatch(seed+i,spec));
 return {seed,count,completed:games.length,summary:summarize(games),profiles:profileProbe(seed,count),games};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=runAudit({seed:Number(process.argv[2]||4101),count:Number(process.argv[3]||8)});
 console.log(JSON.stringify(report));
}
