// Reproducible, opt-in diagnostic suite. No browser, dependencies, or repository clone.
// node scripts/navigation-diagnostics.js [matches=8] [seed=1] [--json]
import {createMatch,draftPool,assign,beginCombat,completeCombat} from '../src/headless.js';
import {chooseCpuDraft} from '../src/draft-ai.js';
import {ARENAS,CHASSIS,STEP,spawn,tick,makeChassis,clearLine} from '../src/simulation.js';

function classify(units,timeout){
 const values=Object.values(units);
 const sum=key=>values.reduce((a,u)=>a+(u[key]||0),0);
 const frames=sum('frames')||1;
 const movementRatio=sum('actual')/Math.max(1,sum('intended'));
 const idleRatio=sum('idle')/frames;
 const blockedRatio=sum('blocked')/frames;
 const opportunityRatio=sum('attackOpportunities')/frames;
 const collisions=sum('collisionLoss')/frames;
 const stuck=sum('stuck'),replans=sum('replans');
 let cause='active-combat-or-other';
 if(timeout){
  if(collisions>.25&&movementRatio<.6)cause='collision-deadlock';
  else if(stuck>=2&&blockedRatio>.2)cause='obstacle-stuck-or-oscillation';
  else if(replans>frames/25&&blockedRatio>.15)cause='excessive-replanning';
  else if(idleRatio>.4&&opportunityRatio<.1)cause='movement-inaction';
  else if(opportunityRatio<.08)cause='tactical-stalemate-or-range-avoidance';
  else if(sum('shots')===0)cause='missed-attack-opportunities';
  else cause='engaged-timeout';
 }
 return {cause,movementRatio:+movementRatio.toFixed(3),idleRatio:+idleRatio.toFixed(3),blockedRatio:+blockedRatio.toFixed(3),opportunityRatio:+opportunityRatio.toFixed(3),collisions:sum('collisionLoss'),stuck,replans,reversals:sum('reversals'),shots:sum('shots'),damage:sum('damage')};
}
function summarize(battle,scenario){
 const units=Object.fromEntries(Object.entries(battle.diagnostics.units).map(([id,r])=>[id,((({lastRoute,lastDirection,lastWaypoint,lastTarget,...rest})=>rest)(r))]));
 const timeout=battle.time>=30-1e-6;
 return {scenario,arena:battle.arena.name,duration:+battle.time.toFixed(2),timeout,summary:classify(units,timeout),units};
}
function play(battle,scenario){
 battle.diagnostics={units:{}};
 for(let i=0;i<900;i++)if(tick(battle,STEP)!==null)break;
 return summarize(battle,scenario);
}
export function runNavigationDiagnostics({matches=8,seed=1}={}){
 if(!Number.isInteger(matches)||matches<1||matches>100)throw Error('matches must be 1..100');
 if(!Number.isInteger(seed))throw Error('seed must be an integer');
 const battles=[];
 for(let i=0;i<matches;i++){
  const match=createMatch(undefined,seed+i);draftPool(match);
  while(match.phase!=='finished'&&match.round<=30){
   while(match.phase==='draft'){
    const player=match.draft.order[match.draft.turn],choice=chooseCpuDraft(match,player);
    assign(match,player,choice.card.uid,choice.chassisIndex,choice.passiveSlot);
   }
   const battle=beginCombat(match);
   battles.push(play(battle,'seed '+(seed+i)+' round '+match.round));
   completeCombat(match,battle);
  }
 }
 // Fixed stationary targets isolate terrain routing from enemy decisions.
 const fixtures=[];
 for(const arena of ARENAS.slice(1))for(const type of Object.keys(CHASSIS)){
  const players=[{name:'A',hp:100,squad:[makeChassis(type)]},{name:'B',hp:100,squad:[makeChassis('bruiser')]}];
  const b=spawn(players,arena,seed),a=b.units[0],enemy=b.units[1];
  a.x=arena===ARENAS[1]?255:315;a.y=arena===ARENAS[1]?215:200;
  enemy.x=arena===ARENAS[1]?360:420;enemy.y=a.y;
  a.cd=enemy.cd=1000;
  // Freeze the target position across ticks so the route fixture is reproducible.
  const fixed={x:enemy.x,y:enemy.y};
  b.diagnostics={units:{}};
  let everClear=false;
  for(let t=0;t<300;t++){
   tick(b,STEP);enemy.x=fixed.x;enemy.y=fixed.y;enemy.moveDecision={x:0,y:0};enemy.intent={x:0,y:0};
   everClear ||=clearLine(a,enemy,arena)&&Math.hypot(a.x-enemy.x,a.y-enemy.y)<=CHASSIS[type].range;
  }
  fixtures.push({...summarize(b,'fixed '+arena.name+' '+type),everClear});
 }
 const navigationFlags=battles.flatMap(b=>Object.entries(b.units)
  .filter(([id,u])=>(u.maxPursuitStallFrames||0)>=90)
  .map(([id,u])=>({scenario:b.scenario,id,owner:u.owner,type:u.type,stalledSeconds:+(u.maxPursuitStallFrames*STEP).toFixed(2),shots:u.shots,blockedFrames:u.blocked})));
 const timeouts=battles.filter(b=>b.timeout);
 const causes={};for(const b of timeouts)causes[b.summary.cause]=(causes[b.summary.cause]||0)+1;
 return {config:{matches,seed},battles:battles.length,timeouts:timeouts.length,causes,navigationFlags,timeoutDetails:timeouts,fixtures};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const report=runNavigationDiagnostics({matches:Number(process.argv[2]||8),seed:Number(process.argv[3]||1)});
 if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));
 else{
  console.log('NAVIGATION DIAGNOSTICS: '+report.battles+' battles, '+report.timeouts+' timeouts');
  console.log('Timeout classifications: '+JSON.stringify(report.causes));
  console.log('Pursuit immobilizations >=3s: '+report.navigationFlags.length);
  for(const flag of report.navigationFlags)console.log(flag.scenario+': '+flag.type+' '+flag.id+' immobilized '+flag.stalledSeconds+'s');
  for(const b of report.timeoutDetails)console.log(b.scenario+': '+b.summary.cause+'; blocked '+b.summary.blockedRatio+', idle '+b.summary.idleRatio+', replans '+b.summary.replans+', collision loss '+b.summary.collisions);
  for(const b of report.fixtures)console.log(b.scenario+': '+(b.everClear?'route regained':'NO CLEAR ROUTE')+'; stuck '+b.summary.stuck+', replans '+b.summary.replans);
  console.log('Use --json for detailed per-unit traces.');
 }
 if(report.navigationFlags.length||report.fixtures.some(f=>!f.everClear)){
  console.error('Navigation regression: prolonged immobilization or failed fixed-terrain approach');
  process.exitCode=1;
 }
}
