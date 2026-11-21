// Deterministic, renderer-free interactive playtesting session.
// A human or AI agent chooses seat 0 drafts; the other seats use the existing CPU.
// Decisions are explicit: no hidden automatic picks for the tested player.
import {CHASSIS,STEP,METRICS,stats,targetScoreDetails} from '../src/simulation.js';
import {createMatch,draftPool,assign,legal,beginCombat,completeCombat} from '../src/headless.js';
import {chooseCpuDraft,scoreDraft} from '../src/draft-ai.js';
import {tick} from '../src/simulation.js';

const copy=value=>JSON.parse(JSON.stringify(value));
const unitView=(unit,index)=>({
 slot:index,type:unit.type,stats:stats({type:unit.type,chassis:unit}),
 weights:{...unit.weights},mods:{...unit.mods},
 passives:[...unit.passives],modules:copy(unit.modules)
});
const playerView=(p,index)=>({seat:index,name:p.name,hp:p.hp,streak:p.streak,squad:p.squad.map(unitView)});
function choices(match,seat){
 const p=match.players[seat];
 return match.draft.pool.flatMap(card=>{
  if(!legal(p,card))return [];
  const slots=card.kind==='unit'?1:p.squad.length;
  return Array.from({length:slots},(_,slot)=>slot).flatMap(slot=>{
   const count=card.kind==='passive'&&p.squad[slot].passives.length>=2?2:1;
   return Array.from({length:count},(_,passiveSlot)=>({
    uid:card.uid,card:card.name,kind:card.kind,key:card.key,
    slot,passiveSlot,botScore:scoreDraft(p,card,slot,passiveSlot)
   }));
  });
 });
}
function snapshot(battle){
 return {time:+battle.time.toFixed(3),units:battle.units.map(u=>{
  const target=battle.units.find(e=>e.id===u.focus);
  const enemies=battle.units.filter(e=>e.hp>0&&e.owner!==u.owner);
  return {id:u.id,owner:u.owner,type:u.type,hp:+u.hp.toFixed(2),maxHp:u.maxHp,
   x:+u.x.toFixed(2),y:+u.y.toFixed(2),target:u.focus,
   targetScore:target&&target.hp>0?targetScoreDetails(battle,u,target).total:null,
   move:u.moveDecision?{x:u.moveDecision.x,y:u.moveDecision.y}:null,
   cooldown:+Math.max(0,u.cd).toFixed(3),mobilityCooldowns:{...u.mobilityCd},
   weights:{...u.chassis.weights},alive:u.hp>0};
 })};
}
export function createPlaytest({seed=12345,types=['bruiser','rogue','ranged','bruiser'],seat=0,traceInterval=1}={}){
 if(!Number.isInteger(seat)||seat<0||seat>=types.length)throw Error('Invalid controlled seat');
 if(!Number.isFinite(traceInterval)||traceInterval<=0)throw Error('traceInterval must be positive');
 const match=createMatch(types,seed);draftPool(match);
 const history=[],battles=[];
 const state=()=>({
  seed,seat,phase:match.phase,round:match.round,players:match.players.map(playerView),
  draft:match.phase==='draft'?{
   order:[...match.draft.order],turn:match.draft.turn,
   currentSeat:match.draft.order[match.draft.turn],
   offers:copy(match.draft.originalPool),
   picks:copy(match.draft.picks),
   choices:match.draft.order[match.draft.turn]===seat?choices(match,seat):[]
  }:null,
  history:copy(history)
 });
 function advanceBots(){
  while(match.phase==='draft'&&match.draft.order[match.draft.turn]!==seat){
   const bot=match.draft.order[match.draft.turn],pick=chooseCpuDraft(match,bot);
   assign(match,bot,pick.card.uid,pick.chassisIndex,pick.passiveSlot);
   history.push({round:match.round,kind:'draft',seat:bot,card:pick.card.name,
    uid:pick.card.uid,slot:pick.chassisIndex,passiveSlot:pick.passiveSlot,source:'cpu'});
  }
  return state();
 }
 function pick(uid,slot=0,passiveSlot=0){
  if(match.phase!=='draft')throw Error('Not in draft phase');
  advanceBots();
  if(match.phase!=='draft'||match.draft.order[match.draft.turn]!==seat)throw Error('Not your draft turn');
  const allowed=choices(match,seat).find(c=>c.uid===uid&&c.slot===slot&&c.passiveSlot===passiveSlot);
  if(!allowed)throw Error('Illegal pick/slot; consult state().draft.choices');
  assign(match,seat,uid,slot,passiveSlot);
  history.push({round:match.round,kind:'draft',seat,card:allowed.card,uid,slot,passiveSlot,source:'agent'});
  return advanceBots();
 }
 function fight({trace=true}={}){
  if(match.phase!=='combat')throw Error('Complete all draft picks before combat');
  const battle=beginCombat(match),frames=[],events=[],samples=trace?Math.ceil(traceInterval/STEP):Infinity;
  let outcome=null;
  if(trace)frames.push(snapshot(battle));
  for(let i=0;i<900;i++){
   outcome=tick(battle,STEP);
   for(const e of battle.events.splice(0))events.push({time:+battle.time.toFixed(3),text:e});
   if(trace&&((i+1)%samples===0||outcome!==null))frames.push(snapshot(battle));
   if(outcome!==null)break;
  }
  const result=completeCombat(match,battle);
  const report={round:result.round,arena:battle.arena.name,seed,combatTime:result.time,
   timedOut:result.time>=30-1e-6,ranking:[...result.ranking],damage:[...result.damage],
   remaining:[...result.remaining],eliminations:copy(result.eliminations),
   events,frames};
  battles.push(report);
  history.push({kind:'combat',round:result.round,arena:report.arena,
   ranking:report.ranking,damage:report.damage,remaining:report.remaining,
   timedOut:report.timedOut,combatTime:report.combatTime});
  if(match.phase==='draft')advanceBots();
  return {report:copy(report),state:state()};
 }
 function run(policy,{maxRounds=250,trace=false}={}){
  if(typeof policy!=='function')throw Error('run requires a draft policy function');
  const rounds=[];
  while(match.phase!=='finished'&&match.round<=maxRounds){
   advanceBots();
   if(match.phase==='draft'){
    const current=state(),choice=policy(current);
    if(!choice||typeof choice.uid!=='string')throw Error('Policy must return {uid,slot,passiveSlot}');
    pick(choice.uid,choice.slot??0,choice.passiveSlot??0);
   }
   if(match.phase==='combat')rounds.push(fight({trace}).report);
  }
  return {winner:match.phase==='finished'?match.players.findIndex(p=>p.hp>0):null,
   completed:match.phase==='finished',rounds,final:state()};
 }
 advanceBots();
 return {state,pick,fight,run,history:()=>copy(history),battles:()=>copy(battles)};
}
export function cpuPolicy(s){
 const picks=s.draft?.choices||[];
 if(!picks.length)throw Error('No legal draft options');
 const best=picks.reduce((a,b)=>b.botScore>a.botScore?b:a);
 return {uid:best.uid,slot:best.slot,passiveSlot:best.passiveSlot};
}
export function playBatch({matches=20,seed=12345,policy=cpuPolicy,types=['bruiser','rogue','ranged','bruiser']}={}){
 const results=[];
 for(let i=0;i<matches;i++){
  const seat=i%4,rotated=types.slice(seat).concat(types.slice(0,seat));
  const session=createPlaytest({seed:seed+i,types:rotated,seat:0});
  const result=session.run(policy,{trace:false});
  results.push({seed:seed+i,startingType:rotated[0],winner:result.winner,
   won:result.winner===0,rounds:result.rounds.length,
   timeouts:result.rounds.filter(r=>r.timedOut).length,
   drafts:result.final.history.filter(e=>e.kind==='draft'&&e.seat===0)});
 }
 return {matches:results.length,wins:results.filter(r=>r.won).length,
  winRate:results.filter(r=>r.won).length/results.length,
  timeouts:results.reduce((n,r)=>n+r.timeouts,0),results};
}
