// Reproducible strategic-bot build-diversity and standout audit.
// Usage: node scripts/build-audit.js [matches=12] [seed=2101] [--json]
// Runs the real combat engine; this report does not change game balance.
import {createMatch,draftPool,assign,beginCombat,completeCombat,ATTACK_MODULES} from '../src/headless.js';
import {chooseCpuDraft,draftPersonality,TRAITS} from '../src/draft-ai.js';
import {CHASSIS,STEP,tick} from '../src/simulation.js';

const PAIRS=[
 ['hazardous','disruption'],['projectiles','piercing'],['momentum','dash'],
 ['burning','restless'],['chain','area'],['restless','expose'],['burning','range'],
 ['momentum','haste'],['momentum','flank']
];
const round=n=>Number(n.toFixed(2));
const bump=(record,key,amount=1)=>{record[key]=(record[key]||0)+amount};
const isActive=(ch,key)=>ch.mods[key]>0||ch.passives.includes(key);
const attackMods=ch=>Object.entries(ch.mods).filter(([key,n])=>n>0&&ATTACK_MODULES.includes(key))
 .map(([key,n])=>key+(n>1?'×'+n:''));
function snapshot(ch,teamSize){
 return {type:ch.type,teamSize,attack:attackMods(ch),
  utility:[...ch.passives],
  targeting:Object.entries(ch.weights).filter(([key,n])=>n>=1.8).map(([key,n])=>key+':'+round(n))};
}
export function runBuildAudit({matches=12,seed=2101,maxRounds=100}={}){
 if(!Number.isInteger(matches)||matches<1||matches>1000)throw Error('matches must be 1..1000');
 if(!Number.isInteger(seed))throw Error('seed must be an integer');
 const results={config:{matches,seed,maxRounds},completed:0,combats:0,timeouts:0,
  rounds:[],draftPicks:{},pickCategories:{},sizeAtFinish:{},startingWins:{},
  pairOccurrences:{},chassis:{},standouts:[],matchWinners:[],
  moduleDamage:{},moduleHits:{},chainRedirected:0,moduleTelemetry:{},
  personalityWinners:{},personalityPlayers:{}};
 for(let trial=0;trial<matches;trial++){
  const matchSeed=(seed+trial)>>>0,types=Object.keys(CHASSIS);
  const starting=Array.from({length:4},(_,i)=>types[(i+trial)%types.length]);
  const match=createMatch(starting,matchSeed),fighters=new Map();
  draftPool(match);
  let rounds=0;
  while(match.phase!=='finished'&&match.round<=maxRounds){
   while(match.phase==='draft'){
    const seat=match.draft.order[match.draft.turn],choice=chooseCpuDraft(match,seat);
    bump(results.draftPicks,choice.card.kind+':'+choice.card.key);
    bump(results.pickCategories,choice.card.kind);
    assign(match,seat,choice.card.uid,choice.chassisIndex,choice.passiveSlot,choice);
   }
   const battle=beginCombat(match);battle.moduleTelemetry={};
   for(let step=0;step<900;step++)if(tick(battle,STEP)!==null)break;
   results.combats++;rounds++;
   if(battle.time>=30-1e-6)results.timeouts++;
   for(const unit of battle.units){
    const chassis=match.players[unit.owner].squad[unit.id%100];
    for(const [key,metrics] of Object.entries(battle.moduleTelemetry[unit.id]||{})){const row=results.moduleTelemetry[key]||={};for(const [metric,value] of Object.entries(metrics))bump(row,metric,value);}
    let record=fighters.get(unit.id);
    if(!record){
     record={seat:unit.owner,slot:unit.id%100,type:unit.type,
      damage:0,damageTaken:0,seconds:0,battles:0,survived:0,
      peakDps:0,peakRound:0,peakBuild:null,moduleDamage:{},moduleHits:{}};
     fighters.set(unit.id,record);
    }
    const damage=unit.combatStats?.damage||0;
    record.damage+=damage;record.damageTaken+=unit.combatStats?.damageTaken||0;
    record.seconds+=battle.time;record.battles++;
    record.survived+=Number(unit.hp>0);
    for(const [key,damage] of Object.entries(unit.combatStats?.moduleDamage||{})){
     bump(record.moduleDamage,key,damage);bump(results.moduleDamage,key,damage);
    }
    for(const [key,damage] of Object.entries(unit.combatStats?.moduleHits||{})){
     bump(record.moduleHits,key,damage);bump(results.moduleHits,key,damage);
    }
    results.chainRedirected+=unit.combatStats?.chainRedirected||0;
    const dps=damage/Math.max(.001,battle.time);
    if(dps>record.peakDps){
     record.peakDps=dps;record.peakRound=match.round;
     record.peakBuild=snapshot(chassis,match.players[unit.owner].squad.length);
    }
   }
   completeCombat(match,battle);
  }
  results.rounds.push(rounds);
  if(match.phase!=='finished')continue;
  results.completed++;
  const winner=match.players.findIndex(p=>p.hp>0);
  bump(results.startingWins,starting[winner]);
  results.matchWinners.push({seed:matchSeed,winner,starter:starting[winner],
   squadSize:match.players[winner].squad.length,rounds});
  for(let seat=0;seat<4;seat++){
   const player=match.players[seat],won=seat===winner;
   bump(results.sizeAtFinish,player.squad.length);
   const personality=draftPersonality(match.seed,seat);
   const dominant=TRAITS.slice().sort((a,b)=>personality[b]-personality[a])[0];
   bump(results.personalityPlayers,dominant);
   if(won)bump(results.personalityWinners,dominant);
   for(const ch of player.squad)for(const pair of PAIRS){
    if(!pair.every(key=>isActive(ch,key)))continue;
    const name=pair.join('+');
    const entry=results.pairOccurrences[name]||(results.pairOccurrences[name]={players:0,winnerPlayers:0});
    entry.players++;entry.winnerPlayers+=Number(won);
   }
  }
  for(const fighter of fighters.values()){
   if(fighter.battles<3)continue; // exclude a lucky one-round spike
   const dps=fighter.damage/fighter.seconds;
   const result={seed:matchSeed,seat:fighter.seat,slot:fighter.slot,
    won:fighter.seat===winner,type:fighter.type,combatRounds:fighter.battles,
    cumulativeDamage:round(fighter.damage),dps:round(dps),
    survivalPct:round(fighter.survived/fighter.battles*100),
    peakRound:fighter.peakRound,peakDps:round(fighter.peakDps),
    peakBuild:fighter.peakBuild,
    moduleDamage:Object.fromEntries(Object.entries(fighter.moduleDamage).map(([k,v])=>[k,round(v)])),
    enabledHitDamage:Object.fromEntries(Object.entries(fighter.moduleHits).map(([k,v])=>[k,round(v)]))};
   results.standouts.push(result);
   const totals=results.chassis[fighter.type]||(results.chassis[fighter.type]={fighters:0,damage:0,seconds:0});
   totals.fighters++;totals.damage+=fighter.damage;totals.seconds+=fighter.seconds;
  }
 }
 results.standouts.sort((a,b)=>b.dps-a.dps||b.cumulativeDamage-a.cumulativeDamage);
 results.standouts=results.standouts.slice(0,20);
 for(const value of Object.values(results.chassis)){
  value.damage=round(value.damage);value.dps=round(value.damage/value.seconds);
  value.seconds=round(value.seconds);
 }
 results.moduleDamage=Object.fromEntries(Object.entries(results.moduleDamage)
  .sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,round(v)]));
 results.moduleHits=Object.fromEntries(Object.entries(results.moduleHits)
  .sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,round(v)]));
 results.chainRedirected=round(results.chainRedirected);
 results.averageRounds=round(results.rounds.reduce((a,b)=>a+b,0)/Math.max(1,results.rounds.length));
 return results;
}
export function formatBuildAudit(r){
 const lines=[
  'Build audit: '+r.completed+'/'+r.config.matches+' matches complete; seed '+r.config.seed,
  'Combat rounds: '+r.combats+'; timeouts: '+r.timeouts+'; avg rounds/match: '+r.averageRounds,
  'Pick categories: '+JSON.stringify(r.pickCategories),
  'Final squad counts: '+JSON.stringify(r.sizeAtFinish),
  'Per-chassis average combat DPS: '+JSON.stringify(Object.fromEntries(Object.entries(r.chassis).map(([k,v])=>[k,v.dps]))),
  'Attributable damage by module: '+JSON.stringify(r.moduleDamage),
  'Damage from delivery-enabled hits (overlapping): '+JSON.stringify(r.moduleHits),
  'Primary damage redirected by Chain (not a bonus): '+r.chainRedirected,
  'Opt-in mechanical counters: '+JSON.stringify(r.moduleTelemetry),
  'Top cumulative-performance fighters (min 3 combat rounds):'];
 for(const f of r.standouts.slice(0,10)){
  lines.push('  seed '+f.seed+' seat '+f.seat+' '+f.type+' · '+f.dps+' damage/sec over '+f.combatRounds+
   ' rounds · '+f.cumulativeDamage+' total · '+(f.won?'winner':'not winner')+
   ' · peak-round build '+JSON.stringify(f.peakBuild)+
   ' · module damage '+JSON.stringify(f.moduleDamage));
 }
 lines.push('Notable interactions: '+JSON.stringify(r.pairOccurrences));
 return lines.join('\n');
}
if(typeof process!=='undefined'&&process.argv[1]&&
 import.meta.url===new URL('file://'+process.argv[1]).href){
 const args=process.argv.slice(2),report=runBuildAudit({matches:Number(args[0]||12),seed:Number(args[1]||2101)});
 console.log(args.includes('--json')?JSON.stringify(report,null,2):formatBuildAudit(report));
 if(report.completed!==report.config.matches)process.exitCode=1;
}
