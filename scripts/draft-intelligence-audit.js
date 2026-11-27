// Head-to-head policy comparison using the unchanged 3.3 engine and actual shared draft.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createMatch,draftPool,assign,beginCombat,completeCombat,legal,canEquip} from '../src/headless.js';
import {CHASSIS,tick,STEP,makeChassis} from '../src/simulation.js';
import {chooseCpuDraft,draftPersonality,draftContext,draftEvaluator,TRAITS} from '../src/draft-ai.js';
import {buildCoherence,coherenceDelta} from '../src/draft-coherence.js';
const TYPES=Object.keys(CHASSIS),POLICIES=['legacy','candidate'];
const inc=(o,k,n=1)=>o[k]=(o[k]||0)+n;
const safe=(n,d)=>d?n/d:null;
const mean=xs=>safe(xs.reduce((s,x)=>s+x,0),xs.length);
const jaccard=(a,b)=>{const x=new Set(a),y=new Set(b),union=new Set([...x,...y]);return union.size?1-[...x].filter(k=>y.has(k)).length/union.size:0};
export function allocations(seed,control='legacy',challenger='candidate'){
 const other=1+seed%3;
 const a=Array.from({length:4},(_,i)=>i===0||i===other?challenger:control);
 return [
  {mode:'mixed-a',policies:a},
  {mode:'mixed-b',policies:a.map(x=>x===challenger?control:challenger)},
  {mode:'all-legacy',policies:Array(4).fill(control)},
  {mode:'all-candidate',policies:Array(4).fill(challenger)}
 ];
}
export function startingTypes(seed){
 const initial=[...TYPES,TYPES[seed%3]],offset=seed%4;
 return initial.map((_,i)=>initial[(i+offset)%4]);
}
export function runMatch(seed,{mode,policies}){
 const types=startingTypes(seed),match=createMatch(types,seed),picks=Array.from({length:4},()=>[]),rounds=[],usage=Array.from({length:4},()=>({unitRounds:0,damage:0,attacks:0,hits:0,moduleDamage:{},moduleExposure:{}}));
 draftPool(match);
 while(match.phase!=='finished'&&match.round<=250){
  while(match.phase==='draft'){
   const seat=match.draft.order[match.draft.turn],player=match.players[seat],policy=policies[seat];
   const choice=chooseCpuDraft(match,seat,{policy});
   const {card,chassisIndex,passiveSlot}=choice,u=player.squad[chassisIndex];
   const old=u?.passives.length>=2?u.passives[passiveSlot]:null;
   const replacing=(card.kind==='passive'||card.kind==='utility')&&old&&old!==card.key&&!(card.kind==='utility'&&u.passives.includes(card.key));
   const ctx=draftContext(match,seat),before=buildCoherence(player,ctx);
   const neutral=draftEvaluator(policy)(player,card,chassisIndex,passiveSlot,{},ctx).score;
   const delta=coherenceDelta(player,card,chassisIndex,passiveSlot,ctx,before).delta;
   let availableGain=0;
   for(const option of match.draft.pool)if(legal(player,option)){
    for(let slot=0;slot<(option.kind==='unit'?1:player.squad.length);slot++){
     if(option.kind!=='unit'&&!canEquip(player.squad[slot],option))continue;
     const n=['utility','passive'].includes(option.kind)&&player.squad[slot].passives.length>=2?2:1;
     for(let ps=0;ps<n;ps++)availableGain=Math.max(availableGain,coherenceDelta(player,option,slot,ps,ctx,before).delta);
    }
   }
   picks[seat].push({round:match.round,kind:card.kind,key:card.key,slot:chassisIndex,type:card.kind==='unit'?card.key:u.type,
    score:choice.baseScore,personalityContribution:choice.baseScore-neutral,replaced:replacing?old:null,coherenceDelta:delta,availableGain,
    reasons:choice.reasons,breakdown:choice.breakdown});
   assign(match,seat,card.uid,chassisIndex,passiveSlot,choice);
  }
  const battle=beginCombat(match);let end=null;
  for(let i=0;i<900;i++){end=tick(battle,STEP);if(end!==null)break;}
  assert.notEqual(end,null,'combat did not complete');
  const result=completeCombat(match,battle);
  for(const row of result.combatReport){
   const u=battle.units.find(x=>x.id===row.id),r=usage[row.owner];
   r.unitRounds++;r.damage+=row.damage;r.attacks+=row.attacks;r.hits+=row.hits;
   for(const [key,v] of Object.entries(row.moduleDamage||{}))inc(r.moduleDamage,key,v);
   for(const key of ['momentum','precision','burning','hazardous','expose','resonance','chain','sunder'])if(u?.chassis.mods[key]>0)inc(r.moduleExposure,key);
  }
  rounds.push({round:result.round,ranking:result.ranking,remaining:result.remaining,timeout:result.time>=30-1e-6,time:result.time});
 }
 assert.equal(match.phase,'finished');
 const winner=match.players.findIndex(p=>p.hp>0);
 const eliminated=match.players.map((p,i)=>({i,death:rounds.findIndex(r=>r.remaining[i]===0)})).filter(x=>x.i!==winner).sort((a,b)=>b.death-a.death||a.i-b.i);
 const finalOrder=[winner,...eliminated.map(x=>x.i)];
 const seats=match.players.map((p,i)=>({seat:i,policy:policies[i],starting:types[i],personality:draftPersonality(seed,i),rank:finalOrder.indexOf(i)+1,
  won:i===winner,usage:usage[i],finalCoherence:buildCoherence(p).total,roster:p.squad.map(u=>({type:u.type,mods:u.mods,weights:u.weights,passives:u.passives})),picks:picks[i]}));
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
 const usage={unitRounds:0,damage:0,attacks:0,hits:0,moduleDamage:{},moduleExposure:{}};
 for(const s of seats){for(const k of ['unitRounds','damage','attacks','hits'])usage[k]+=s.usage[k];for(const k of ['moduleDamage','moduleExposure'])for(const [key,v] of Object.entries(s.usage[k]))inc(usage[k],key,v);}
 const opportunities=all.filter(p=>p.availableGain>1e-8);
 return {coherence:{finalSum:seats.reduce((n,s)=>n+s.finalCoherence,0),opportunities:opportunities.length,positivePicks:opportunities.filter(p=>p.coherenceDelta>1e-8).length,chosenDelta:all.reduce((n,p)=>n+p.coherenceDelta,0),possibleGain:opportunities.reduce((n,p)=>n+p.availableGain,0),chosenGain:opportunities.reduce((n,p)=>n+Math.max(0,p.coherenceDelta),0),lostPicks:all.filter(p=>p.coherenceDelta< -1e-8).length},usage,players:seats.length,wins:seats.filter(s=>s.won).length,rankSum:seats.reduce((n,s)=>n+s.rank,0),picks:all.length,
  moduleCounts:counts,categories,starts,finalSizes,firstRecruit:{n:firstRecruit.length,sum:firstRecruit.reduce((n,x)=>n+x,0)},
  thirdRecruit:{n:thirdRecruit.length,sum:thirdRecruit.reduce((n,x)=>n+x,0)},replacements:all.filter(p=>p.replaced).length,
  personalitySum:all.reduce((n,p)=>n+p.personalityContribution,0),entropy,
  distinctPerPlayerSum:seats.reduce((n,s)=>n+new Set(s.picks.filter(p=>p.kind!=='unit').map(p=>p.kind+':'+p.key)).size,0)};
}
function summarize(games,policies=POLICIES){
 const groups={};
 for(const mode of ['mixed','all-legacy','all-candidate']){
  const ms=games.filter(g=>mode==='mixed'?g.mode.startsWith('mixed'):g.mode===mode);
  const seats=ms.flatMap(g=>g.seats),metrics={};
  for(const p of policies)metrics[p]=groupMetrics(seats.filter(s=>s.policy===p));
  const diversity=ms.flatMap(g=>g.seats.flatMap((s,i)=>g.seats.slice(i+1).map(t=>jaccard(s.picks.filter(p=>p.kind!=='unit').map(p=>p.kind+':'+p.key),t.picks.filter(p=>p.kind!=='unit').map(p=>p.kind+':'+p.key)))));
  const allRounds=ms.flatMap(g=>g.rounds);
  groups[mode]={matches:ms.length,rounds:allRounds.length,timeouts:allRounds.filter(r=>r.timeout).length,
   diversitySum:diversity.reduce((n,x)=>n+x,0),diversityPairs:diversity.length,policies:metrics};
 }
 return groups;
}
// Same legal offer pool, same chassis and weights, no RNG for scoring.
export function profileProbe(seed,count,policies=POLICIES){
 const results={};
 for(const policy of policies){
  const evaluate=draftEvaluator(policy);
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
export function runAudit({seed=4101,count=8,control='legacy',challenger='candidate'}={}){
 assert.ok(Number.isInteger(seed)&&Number.isInteger(count)&&count>0&&count<=30);
 const games=[];
 for(let i=0;i<count;i++)for(const spec of allocations(seed+i,control,challenger))games.push(runMatch(seed+i,spec));
 return {seed,count,control,challenger,completed:games.length,summary:summarize(games,[control,challenger]),profiles:profileProbe(seed,count,[control,challenger]),games};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=runAudit({seed:Number(process.argv[2]||4101),count:Number(process.argv[3]||8),control:process.argv[4]||'legacy',challenger:process.argv[5]||'candidate'});
 console.log(JSON.stringify(report));
}
