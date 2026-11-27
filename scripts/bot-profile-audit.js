// Four-way seat rotation: each skill and unchanged empirical reference
// occupy every seat on the same seed. Additional sampled-profile lobbies.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createMatch,draftPool,assign,beginCombat,completeCombat,legal,canEquip} from '../src/headless.js';
import {tick,STEP} from '../src/simulation.js';
import {chooseCpuDraft,evaluateDraftEmpirical,draftContext,draftPersonality} from '../src/draft-ai.js';
import {botProfile} from '../src/bot-profiles.js';
import {startingTypes} from './draft-intelligence-audit.js';
const tiers=['casual','regular','experienced','reference'];
const add=(o,k,v=1)=>o[k]=(o[k]||0)+v;
function bestScore(m,seat,prefs){
 const p=m.players[seat],ctx=draftContext(m,seat);let best=-Infinity;
 for(const card of m.draft.pool)if(legal(p,card))for(let slot=0;slot<(card.kind==='unit'?1:p.squad.length);slot++){
  if(card.kind!=='unit'&&!canEquip(p.squad[slot],card))continue;
  const slots=['utility','passive'].includes(card.kind)&&p.squad[slot].passives.length>=2?2:1;
  for(let ps=0;ps<slots;ps++)best=Math.max(best,evaluateDraftEmpirical(p,card,slot,ps,prefs,ctx).score);
 }
 return best;
}
export function play(seed,rotation=null){
 const m=createMatch(startingTypes(seed),seed),seats=m.players.map((p,i)=>{
  const tier=rotation===null?null:tiers[(i+rotation)%4];
  const profile=tier==='reference'?null:botProfile(seed,i,draftPersonality(seed,i),tier?{skill:tier}:{});
  return {tier:tier||profile.skill,style:profile?.style||'reference',picks:0,gap:0,nonbest:0,cards:{},roundRanks:0,rounds:0};
 });
 draftPool(m);let rounds=0,timeouts=0;
 while(m.phase!=='finished'&&m.round<=250){
  while(m.phase==='draft'){
   const i=m.draft.order[m.draft.turn],s=seats[i],p=m.players[i];
   const choice=chooseCpuDraft(m,i,s.tier==='reference'?{policy:'empirical'}:{policy:'profiled',profile:{skill:s.tier,style:s.style}});
   const selected=evaluateDraftEmpirical(p,choice.card,choice.chassisIndex,choice.passiveSlot,choice.preferences,draftContext(m,i)).score;
   const gap=Math.max(0,bestScore(m,i,choice.preferences)-selected);
   s.picks++;s.gap+=gap;s.nonbest+=Number(gap>1e-6);add(s.cards,choice.card.kind+':'+choice.card.key);
   assign(m,i,choice.card.uid,choice.chassisIndex,choice.passiveSlot,choice);
  }
  const b=beginCombat(m);let end=null;for(let j=0;j<900;j++){end=tick(b,STEP);if(end!==null)break;}
  assert.notEqual(end,null);
  const r=completeCombat(m,b);rounds++;timeouts+=Number(r.time>=30-1e-6);
  for(const [rank,i] of r.ranking.entries()){seats[i].rounds++;seats[i].roundRanks+=rank+1;}
 }
 assert.equal(m.phase,'finished');const winner=m.players.findIndex(p=>p.hp>0);
 const dead=m.players.map((p,i)=>({i,t:m.history.findIndex(r=>r.remaining[i]===0)})).filter(x=>x.i!==winner).sort((a,b)=>b.t-a.t||a.i-b.i);
 const order=[winner,...dead.map(x=>x.i)];
 return {seed,rotation,rounds,timeouts,seats:seats.map((s,i)=>({...s,won:Number(i===winner),rank:order.indexOf(i)+1,starting:startingTypes(seed)[i],finalSize:m.players[i].squad.length}))};
}
function summarize(games){
 const byTier={},byStyle={};
 for(const g of games)for(const s of g.seats){
  for(const [group,key] of [[byTier,s.tier],[byStyle,s.style]]){
   const r=group[key]||={players:0,wins:0,rankSum:0,picks:0,gap:0,nonbest:0,cards:{},finalSizes:{},starting:{}};
   r.players++;r.wins+=s.won;r.rankSum+=s.rank;r.picks+=s.picks;r.gap+=s.gap;r.nonbest+=s.nonbest;
   add(r.finalSizes,s.finalSize);for(const [k,v] of Object.entries(s.cards))add(r.cards,k,v);
   const a=r.starting[s.starting]||={players:0,wins:0};a.players++;a.wins+=s.won;
  }
 }
 return {matches:games.length,rounds:games.reduce((n,g)=>n+g.rounds,0),timeouts:games.reduce((n,g)=>n+g.timeouts,0),byTier,byStyle};
}
export function audit(seed,count){
 const rotations=[],random=[];
 for(let i=0;i<count;i++){for(let rotation=0;rotation<4;rotation++)rotations.push(play(seed+i,rotation));random.push(play(seed+i,null));}
 return {seed,count,rotation:summarize(rotations),random:summarize(random),games:[...rotations,...random]};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(audit(Number(process.argv[2]||7101),Number(process.argv[3]||8))));
