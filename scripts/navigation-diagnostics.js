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
// Symmetric defensive teams test whether tactical holding becomes reciprocal
// inaction. A full 30-second defensive fight is fine; three seconds of mutual
// passivity with neither side attempting to engage is a diagnostic failure.
export function runDefensiveStandoffDiagnostics({seed=7701}={}){
 const fixtures=[];
 for(const arena of ARENAS){
  const players=[0,1].map(i=>({name:'Defensive '+i,hp:100,streak:0,
   squad:[makeChassis('bruiser'),makeChassis('ranged')]}));
  for(const p of players)for(const u of p.squad){
   u.weights.safety=2.4;u.weights.distance=.2;
   u.weights.damage=.8;u.weights.protection=1.5;
  }
  const b=spawn(players,arena,seed);
  for(const u of b.units){u.x=u.owner?525:195;u.y=210+(u.id%100)*55;u.cd=0}
  b.diagnostics={units:{}};
  let firstAttack=null,firstDamage=null,ended=false;
  for(let frame=0;frame<900;frame++){
   ended=tick(b,STEP)!==null;
   if(firstAttack===null&&b.units.some(u=>u.combatStats.attacks>0))firstAttack=b.time;
   if(firstDamage===null&&b.units.some(u=>u.combatStats.damage>0))firstDamage=b.time;
   if(ended)break;
  }
  const t=b.diagnostics.tactical||{};
  const releases=b.units.reduce((sum,u)=>sum+u.combatStats.attacks,0);
  const damage=b.units.reduce((sum,u)=>sum+u.combatStats.damage,0);
  fixtures.push({arena:arena.name,duration:+b.time.toFixed(2),timeout:!ended,
   firstAttack:firstAttack===null?null:+firstAttack.toFixed(2),
   firstDamage:firstDamage===null?null:+firstDamage.toFixed(2),
   releases,damage:+damage.toFixed(2),
   holdingUnitFrames:t.holdingUnitFrames||0,
   holdWithAttackAccess:t.holdWithAttackAccess||0,
   holdAwaitingApproach:t.holdAwaitingApproach||0,
   mutualPassiveFrames:t.mutualPassiveFrames||0,
   maxMutualPassiveSeconds:+((t.maxMutualPassiveFrames||0)*STEP).toFixed(2),
   maxMutualPassiveFrames:t.maxMutualPassiveFrames||0,
   prolongedMutualPassivity:(t.maxMutualPassiveFrames||0)>=90,
   fighters:b.units.map(u=>({owner:u.owner,type:u.type,attacks:u.combatStats.attacks,
    damage:+u.combatStats.damage.toFixed(2),
    holds:b.diagnostics.units[u.id]?.deliberateHolds||0}))});
 }
 return fixtures;
}
// Live coordination fixture: idle fighters can support a real engagement,
// but screening must not replace attack initiation or obstruct normal combat.
export function runCooperativeSupportDiagnostics({seed=8261}={}){
 const players=[{name:'Team',hp:100,squad:[makeChassis('bruiser'),makeChassis('ranged'),makeChassis('rogue')]},
  {name:'Opponents',hp:100,squad:[makeChassis('bruiser'),makeChassis('ranged')]}];
 const battle=spawn(players,ARENAS[0],seed);
 for(const u of battle.units){u.x=u.owner?490:150+(u.id%100)*32;u.y=210+(u.id%100)*37;u.cd=0}
 battle.diagnostics={units:{}};
 for(let frame=0;frame<240;frame++)if(tick(battle,STEP)!==null)break;
 const t=battle.diagnostics.tactical||{};
 return {seed,elapsed:+battle.time.toFixed(2),
  supportUnitFrames:t.supportUnitFrames||0,screenUnitFrames:t.screenUnitFrames||0,
  holdingUnitFrames:t.holdingUnitFrames||0,attackReleases:t.attackReleases||0,
  maxMutualPassiveSeconds:+((t.maxMutualPassiveFrames||0)*STEP).toFixed(2),
  units:Object.values(battle.diagnostics.units).map(u=>({owner:u.owner,type:u.type,
   supportFrames:u.supportFrames||0,screenFrames:u.screenFrames||0,
   stalls:u.maxPursuitStallFrames||0,attacks:u.shots||0})),
  passed:(t.supportUnitFrames||0)>0&&(t.screenUnitFrames||0)>0&&
   (t.attackReleases||0)>0&&(t.maxMutualPassiveFrames||0)<90};
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
 return {config:{matches,seed},battles:battles.length,timeouts:timeouts.length,causes,navigationFlags,timeoutDetails:timeouts,fixtures,defensiveStandoffs:runDefensiveStandoffDiagnostics({seed:seed+7700}),cooperativeSupport:runCooperativeSupportDiagnostics()};
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
  for(const b of report.defensiveStandoffs)console.log('DEFENSIVE '+b.arena+': '+b.releases+' attacks, '+b.damage+' damage, first attack '+b.firstAttack+'s, longest mutual inactivity '+b.maxMutualPassiveSeconds+'s');
  console.log('COOPERATIVE: '+report.cooperativeSupport.supportUnitFrames+' supporting frames, '+report.cooperativeSupport.screenUnitFrames+' screening frames, '+report.cooperativeSupport.attackReleases+' attack releases');
  console.log('Use --json for detailed per-unit traces.');
 }
 if(report.navigationFlags.length||report.fixtures.some(f=>!f.everClear)||report.defensiveStandoffs.some(f=>f.prolongedMutualPassivity||f.firstAttack===null)||!report.cooperativeSupport.passed){
  console.error('Navigation regression: prolonged immobilization, reciprocal inactivity or failed fixed-terrain approach');
  process.exitCode=1;
 }
}
