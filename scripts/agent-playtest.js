// Deterministic headless seat-0 strategic agent vs three strategic drafting bots.
// Usage: node scripts/agent-playtest.js [matches=12] [seed=1] [--json]
import {createMatch,draftPool,assign,beginCombat,completeCombat} from '../src/headless.js';
import {chooseCpuDraft} from '../src/draft-ai.js';
import {tick,STEP,CHASSIS} from '../src/simulation.js';

export function runAgentPlaytest({matches=12,seed=1,maxRounds=250}={}){
 if(!Number.isInteger(matches)||matches<1||matches>1000)throw Error('matches must be 1..1000');
 if(!Number.isInteger(seed))throw Error('seed must be an integer');
 const results=[];
 for(let trial=0;trial<matches;trial++){
  const matchSeed=(seed+trial)>>>0;
  const types=Object.keys(CHASSIS);
  const starting=Array.from({length:4},(_,i)=>types[(i+trial)%types.length]);
  const match=createMatch(starting,matchSeed);
  draftPool(match);
  let timeouts=0,combatCount=0;
  const agentPicks=[];
  while(match.phase!=='finished'&&match.round<=maxRounds){
   while(match.phase==='draft'){
    const player=match.draft.order[match.draft.turn];
    const choice=chooseCpuDraft(match,player);
    if(player===0)agentPicks.push({round:match.round,card:choice.card.kind+':'+choice.card.key,chassis:choice.chassisIndex,slot:choice.passiveSlot,baseScore:choice.baseScore,reasons:choice.reasons});
    assign(match,player,choice.card.uid,choice.chassisIndex,choice.passiveSlot,choice);
   }
   const battle=beginCombat(match);
   let ended=false;
   for(let step=0;step<900;step++)if(tick(battle,STEP)!==null){ended=true;break}
   combatCount++;
   if(!ended||battle.time>=30-1e-6)timeouts++;
   completeCombat(match,battle);
  }
  const winner=match.players.findIndex(p=>p.hp>0);
  results.push({seed:matchSeed,finished:match.phase==='finished',winner,agentWon:winner===0,rounds:match.history.length,combats:combatCount,timeouts,agentPicks,agentSquad:match.players[0].squad.map(u=>({type:u.type,passives:[...u.passives],utilities:Object.fromEntries(Object.entries(u.mods).filter(([k,v])=>v>0&&['dash','dodge','backstep','flank','disengage','intercept','followthrough'].includes(k)))}))});
 }
 const completed=results.filter(r=>r.finished).length;
 return {config:{matches,seed,maxRounds},completed,agentWins:results.filter(r=>r.agentWon).length,totalCombats:results.reduce((s,r)=>s+r.combats,0),timeouts:results.reduce((s,r)=>s+r.timeouts,0),results};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const matches=Number(process.argv[2]||12),seed=Number(process.argv[3]||1);
 const report=runAgentPlaytest({matches,seed});
 if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
 else{
  console.log('Agent playtest: '+report.completed+'/'+report.config.matches+' matches completed; seat 0 won '+report.agentWins+'; '+report.timeouts+'/'+report.totalCombats+' combat timeouts');
  for(const r of report.results)console.log('seed '+r.seed+': '+(r.finished?'finished':'UNFINISHED')+', winner seat '+r.winner+', '+r.rounds+' rounds, '+r.timeouts+' timeouts, '+r.agentPicks.length+' agent picks');
 }
 if(completedFailed(report))process.exitCode=1;
}
function completedFailed(report){return report.completed!==report.config.matches}
