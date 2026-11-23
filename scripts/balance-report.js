import {createMatch,draftPool,autoDraft,assign,legal,beginCombat,completeCombat} from '../src/headless.js';
import {chooseCpuDraft} from '../src/draft-ai.js';
import {tick,STEP,CHASSIS,rng} from '../src/simulation.js';

const TYPES=Object.keys(CHASSIS);
const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const pct=(n,d)=>d?Number((100*n/d).toFixed(1)):0;
const rounded=n=>Number(n.toFixed(2));
const increment=(map,key,amount=1)=>map.set(key,(map.get(key)||0)+amount);
const entries=map=>Object.fromEntries([...map].sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));

export function runBalance({matches=100,seed=1,mode='strategic',maxRounds=250}={}){
 if(!Number.isInteger(matches)||matches<1||matches>10000)throw Error('matches must be 1..10000');
 if(!Number.isInteger(seed))throw Error('seed must be an integer');
 if(!['strategic','random'].includes(mode))throw Error('mode must be strategic or random');
 const seats=Array.from({length:4},()=>({games:0,wins:0,placements:[0,0,0,0]}));
 const chassis=Object.fromEntries(TYPES.map(t=>[t,{games:0,wins:0,placements:[0,0,0,0]}]));
 const offers=new Map(),picks=new Map(),pickedWins=new Map(),pickedGames=new Map(),pickedByKind=new Map();
 const matchRounds=[],combatDurations=[],roundDamage=[[],[],[],[]],timeouts=new Map(),arenas=new Map(),rosterSizes=new Map();
 const firstPick=new Map(),firstPickWins=new Map(),unresolved=[];
 let totalRounds=0,totalCombat=0,combatTimeouts=0,completed=0;
 for(let trial=0;trial<matches;trial++){
  // Rotating seats removes the built-in fixed-position advantage from chassis comparisons.
  const rotation=trial%4;
  const repeat=TYPES[Math.floor(trial/4)%TYPES.length];
  const initial=[...TYPES,repeat];
  const types=Array.from({length:4},(_,seat)=>initial[(seat+rotation)%4]);
  const matchSeed=(seed+Math.imul(trial+1,2654435761))>>>0;
  const match=createMatch(types,matchSeed);
  const matchPicks=Array.from({length:4},()=>new Set());
  const firstPicks=Array(4).fill(null);
  draftPool(match);
  while(match.phase!=='finished'&&match.round<=maxRounds){
   const draft=match.draft;
   for(const card of draft.originalPool)increment(offers,card.kind+':'+card.key);
   if(mode==='random')autoDraft(match);
   else while(match.phase==='draft'){
    const player=draft.order[draft.turn],choice=chooseCpuDraft(match,player);
    assign(match,player,choice.card.uid,choice.chassisIndex,choice.passiveSlot,choice);
   }
   for(const pick of draft.picks){
    const card=draft.originalPool.find(c=>c.uid===pick.uid);
    if(!card)throw Error('Draft pick missing original card');
    const key=card.kind+':'+card.key;
    increment(picks,key);increment(pickedByKind,card.kind);
    matchPicks[pick.player].add(key);
    if(match.round===1)firstPicks[pick.player]=key;
   }
   const battle=beginCombat(match);
   for(let step=0;step<900;step++)if(tick(battle,STEP)!==null)break;
   totalCombat++;combatDurations.push(battle.time);
   const timeout=battle.time>=30-1e-6;
   if(timeout)combatTimeouts++;
   increment(arenas,battle.arena.name);
   if(timeout)increment(timeouts,battle.arena.name);
   const result=completeCombat(match,battle);
   for(let place=0;place<result.ranking.length;place++)roundDamage[place].push(result.damage[result.ranking[place]]);
  }
  if(match.phase!=='finished'){unresolved.push(matchSeed);continue}
  completed++;matchRounds.push(match.history.length);totalRounds+=match.history.length;
  const winner=match.players.findIndex(p=>p.hp>0);
  const finalOrder=[winner,...match.lastRanking.filter(i=>i!==winner)];
  // Final rank after elimination: survivor first, then reverse order of permanent elimination.
  const eliminated=match.players.map((p,i)=>({i,death:match.history.findIndex(h=>h.remaining[i]===0)})).filter(x=>x.i!==winner).sort((a,b)=>b.death-a.death||a.i-b.i);
  const placements=[winner,...eliminated.map(x=>x.i)];
  for(let seat=0;seat<4;seat++){
   const place=placements.indexOf(seat);
   seats[seat].games++;seats[seat].wins+=Number(seat===winner);seats[seat].placements[place]++;
   const record=chassis[types[seat]];record.games++;record.wins+=Number(seat===winner);record.placements[place]++;
   increment(rosterSizes,match.players[seat].squad.length);
   for(const key of matchPicks[seat]){increment(pickedGames,key);if(seat===winner)increment(pickedWins,key)}
   if(firstPicks[seat]){increment(firstPick,firstPicks[seat]);if(seat===winner)increment(firstPickWins,firstPicks[seat])}
  }
 }
 const pickStats=[...offers.keys()].map(key=>({module:key,offered:offers.get(key),picked:picks.get(key)||0,pickRate:pct(picks.get(key)||0,offers.get(key)),playersDrafting:pickedGames.get(key)||0,winRateWhenDrafted:pct(pickedWins.get(key)||0,pickedGames.get(key)||0),firstPickCount:firstPick.get(key)||0,firstPickWinRate:pct(firstPickWins.get(key)||0,firstPick.get(key)||0)})).sort((a,b)=>b.picked-a.picked||a.module.localeCompare(b.module));
 const baseline=pct(completed,completed*4);
 const flags=[];
 for(const [type,v] of Object.entries(chassis))if(v.games>=20&&Math.abs(pct(v.wins,v.games)-25)>=10)flags.push({kind:'chassis-win-rate',item:type,rate:pct(v.wins,v.games),baseline:25,n:v.games});
 for(const [seat,v] of seats.entries())if(v.games>=20&&Math.abs(pct(v.wins,v.games)-25)>=10)flags.push({kind:'seat-win-rate',item:'seat '+seat,rate:pct(v.wins,v.games),baseline:25,n:v.games});
 if(totalCombat>=20&&pct(combatTimeouts,totalCombat)>=20)flags.push({kind:'combat-timeout',rate:pct(combatTimeouts,totalCombat),threshold:20,n:totalCombat});
 for(const v of pickStats)if(v.playersDrafting>=30&&Math.abs(v.winRateWhenDrafted-baseline)>=15)flags.push({kind:'module-correlation',item:v.module,rate:v.winRateWhenDrafted,baseline,n:v.playersDrafting,note:'Correlation, not causal module strength'});
 return {config:{matches,seed,mode,maxRounds},completed,unresolved:unresolved.slice(0,20),averageRounds:rounded(avg(matchRounds)),minRounds:Math.min(...matchRounds),maxRoundsObserved:Math.max(...matchRounds),combat:{battles:totalCombat,averageSeconds:rounded(avg(combatDurations)),timeoutCount:combatTimeouts,timeoutPct:pct(combatTimeouts,totalCombat),arenas:entries(arenas),timeoutsByArena:entries(timeouts),averageDamageByPlacement:roundDamage.map(xs=>rounded(avg(xs)))},seats:seats.map((v,i)=>({seat:i,games:v.games,wins:v.wins,winRate:pct(v.wins,v.games),placements:v.placements})),startingChassis:Object.fromEntries(Object.entries(chassis).map(([k,v])=>[k,{...v,winRate:pct(v.wins,v.games)}])),modules:pickStats,rosterSizes:entries(rosterSizes),picksByKind:entries(pickedByKind),flags};
}
export function formatBalance(report){
 const lines=[`BALANCE · ${report.config.mode} · ${report.completed}/${report.config.matches} finished · seed ${report.config.seed}`,`Match length: ${report.averageRounds} rounds avg · ${report.minRounds}-${report.maxRoundsObserved}`,`Combat: ${report.combat.averageSeconds}s avg · ${report.combat.timeoutPct}% timeout (${report.combat.timeoutCount}/${report.combat.battles})`,'Starting chassis (win %, sample):'];
 for(const [type,v] of Object.entries(report.startingChassis))lines.push(`  ${type.padEnd(8)} ${String(v.winRate).padStart(5)}% · ${v.games} starts`);
 lines.push('Seat win rates: '+report.seats.map(v=>`P${v.seat} ${v.winRate}%`).join(' · '));
 lines.push('Most selected modules:');
 for(const v of report.modules.slice(0,12))lines.push(`  ${v.module.padEnd(23)} ${String(v.picked).padStart(4)} picks · ${v.pickRate}% of offers · ${v.winRateWhenDrafted}% wins when drafted (n=${v.playersDrafting})`);
 lines.push('Flags:');
 if(!report.flags.length)lines.push('  None at current thresholds');
 for(const f of report.flags)lines.push('  '+f.kind+' '+(f.item||'')+' '+f.rate+'% (n='+f.n+')');
 if(report.unresolved.length)lines.push('Unfinished seeds: '+report.unresolved.join(', '));
 return lines.join('\n');
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const args=process.argv.slice(2),count=Number(args[0]||100),mode=args[1]||'strategic',seed=Number(args[2]||1);
 const report=runBalance({matches:count,mode,seed});
 console.log(args.includes('--json')?JSON.stringify(report,null,2):formatBalance(report));
}
