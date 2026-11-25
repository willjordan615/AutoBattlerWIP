import test from 'node:test';
import assert from 'node:assert/strict';
import {CHASSIS,ARENAS,STEP,makeChassis,stats,bound,chooseTarget,chooseMovement,holdingOpportunity,cooperativeEngagement,positionScore,clearLine,resolveCollision,tick,spawn,placementGroups,placementDamage,resolvePlayerHP,teamPercent,advanceProjectiles,PROJECTILE_SPEED,utilityCooldown,tacticalAssessment,ATTACK_TIMING,startAttack,advanceAttack,attackMovementMultiplier,meleeAttackTargets,resolveAttackModules,targetScoreDetails,ATTACK_STAGES,claimAttackEffect,applyFollowthrough,advanceFollowthrough,UTILITY_MOVE_SCALE,recentMovement,collisionStability,disengageDirection,resolveFollowthroughImpacts} from '../src/simulation.js';
import {ATTACK_MODULES,catalog,createMatch,draftPool,assign,legal,canEquip,beginCombat,completeCombat,ensureDraftChoice} from '../src/headless.js';
import {DETAILS,SUMMARIES,cardDetail,cardSummary} from '../src/module-info.js';
import {players,projectileFixture,testShot} from './simulation-fixtures.js';

test('2.12.1 an approaching enemy makes holding a useful tactical option',()=>{
 const b=spawn(players(),ARENAS[0],6301),u=b.units[0],enemy=b.units[1];
 b.units=[u,enemy];u.x=200;u.y=200;enemy.x=295;enemy.y=200;
 b.time=1;enemy.moveDecision={x:-1,y:0};
 assert.ok(holdingOpportunity(b,u,enemy,stats(u),[enemy])>0);
 const dir=chooseMovement(b,u,enemy,stats(u),[enemy],STEP);
 assert.equal(dir.x,0);assert.equal(dir.y,0);
 assert.ok(u.holdingPosition);
});
test('2.12.1 a stationary enemy outside reach must still be pursued',()=>{
 const b=spawn(players(),ARENAS[0],6302),u=b.units[0],enemy=b.units[1];
 b.units=[u,enemy];u.x=200;u.y=200;enemy.x=295;enemy.y=200;
 b.time=1;enemy.moveDecision={x:0,y:0};
 assert.equal(holdingOpportunity(b,u,enemy,stats(u),[enemy]),0);
 const dir=chooseMovement(b,u,enemy,stats(u),[enemy],STEP);
 assert.ok(dir.x>0);assert.equal(u.holdingPosition,false);
});
test('2.12.1 clear attack positions may be held without disengaging from combat',()=>{
 const p=players();p[0].squad=[makeChassis('ranged')];
 const b=spawn(p,ARENAS[0],6303),u=b.units[0],enemy=b.units[1];
 b.units=[u,enemy];u.x=200;u.y=200;enemy.x=335;enemy.y=200;
 b.time=1;
 assert.ok(holdingOpportunity(b,u,enemy,stats(u),[enemy])>0);
 const dir=chooseMovement(b,u,enemy,stats(u),[enemy],STEP);
 assert.deepEqual(dir,{x:0,y:0});assert.ok(u.holdingPosition);
});
test('2.12.1 ranged fighters should reposition when threatened at point blank range',()=>{
 const p=players();p[0].squad=[makeChassis('ranged')];
 const b=spawn(p,ARENAS[0],6304),u=b.units[0],enemy=b.units[1];
 b.units=[u,enemy];u.x=200;u.y=200;enemy.x=240;enemy.y=200;
 b.time=1;
 assert.equal(holdingOpportunity(b,u,enemy,stats(u),[enemy]),0);
 const dir=chooseMovement(b,u,enemy,stats(u),[enemy],STEP);
 assert.ok(dir.x!==0||dir.y!==0);assert.equal(u.holdingPosition,false);
});
test('2.12.1 holding is distinct from stalled navigation and clears when no longer useful',()=>{
 const b=spawn(players(),ARENAS[0],6305),u=b.units[0],enemy=b.units[1];
 b.units=[u,enemy];u.x=200;u.y=200;enemy.x=295;enemy.y=200;
 b.time=1;enemy.moveDecision={x:-1,y:0};
 for(let i=0;i<5;i++){
  b.time+=.7;chooseMovement(b,u,enemy,stats(u),[enemy],STEP);
 }
 assert.ok(u.holdingPosition);
 assert.equal(u.navStuckCount||0,0,'deliberate hold must not be treated as stuck');
 enemy.moveDecision={x:0,y:0};
 b.time+=STEP;
 const dir=chooseMovement(b,u,enemy,stats(u),[enemy],STEP);
 assert.ok(dir.x>0);assert.equal(u.holdingPosition,false);
});
test('2.12.1 previously holding no longer claims an advancing intention',()=>{
 const b=spawn(players(),ARENAS[0],6306),u=b.units[0],enemy=b.units[1];
 b.units=[u,enemy];u.x=200;u.y=200;enemy.x=295;enemy.y=200;
 enemy.moveDecision={x:-1,y:0};u.holdingPosition=true;u.moveDecision={x:0,y:0};
 tick(b,STEP);
 assert.deepEqual(u.intent,{x:0,y:0});
});

test('2.12.2 symmetric defensive teams initiate engagement without mutual waiting',()=>{
 for(const arena of ARENAS){
  const sides=[0,1].map(i=>({name:'Defensive '+i,hp:100,streak:0,
   squad:[makeChassis('bruiser'),makeChassis('ranged')]}));
  for(const p of sides)for(const unit of p.squad){
   unit.weights.safety=2.4;unit.weights.distance=.2;
   unit.weights.damage=.8;unit.weights.protection=1.5;
  }
  const battle=spawn(sides,arena,7701);
  for(const u of battle.units){u.x=u.owner?525:195;u.y=210+(u.id%100)*55;u.cd=0}
  battle.diagnostics={units:{}};
  for(let i=0;i<180;i++)tick(battle,STEP);
  const totalAttacks=battle.units.reduce((n,u)=>n+u.combatStats.attacks,0);
  const totalDamage=battle.units.reduce((n,u)=>n+u.combatStats.damage,0);
  const telemetry=battle.diagnostics.tactical;
  assert.ok(totalAttacks>0,arena.name+' must initiate attacks');
  assert.ok(totalDamage>0,arena.name+' must deliver damage');
  assert.ok(telemetry.maxMutualPassiveFrames<90,arena.name+' must avoid three-second reciprocal inactivity');
  assert.ok(telemetry.holdingUnitFrames>0,arena.name+' still allows useful tactical holding');
  assert.ok(telemetry.productiveCombatFrames>0);
 }
});
test('2.12.2 tactical telemetry distinguishes holding with attack access from waiting for approach',()=>{
 const p=players(),battle=spawn(p,ARENAS[0],7702),u=battle.units[0],enemy=battle.units[1];
 battle.units=[u,enemy];u.x=200;u.y=200;enemy.x=240;enemy.y=200;
 battle.diagnostics={units:{}};enemy.cd=1000;
 for(let i=0;i<8;i++)tick(battle,STEP);
 assert.ok(battle.diagnostics.tactical.holdingUnitFrames>0);
 assert.ok(battle.diagnostics.tactical.holdWithAttackAccess>0);
 assert.ok(battle.diagnostics.units[u.id].holdWithAttackAccess>0);
 assert.equal(battle.diagnostics.tactical.mutualPassiveFrames,0);
});

test('2.12.3 idle bruiser screens in front of engaged ranged ally without changing targets',()=>{
 const sides=[{hp:100,squad:[makeChassis('bruiser'),makeChassis('ranged')]},
              {hp:100,squad:[makeChassis('rogue')]}];
 const b=spawn(sides,ARENAS[0],8101),bruiser=b.units[0],ranged=b.units[1],enemy=b.units[2];
 b.time=1;bruiser.x=160;bruiser.y=200;ranged.x=200;ranged.y=200;enemy.x=310;enemy.y=200;
 ranged.focus=enemy.id;ranged.attack={phase:'windup'};
 bruiser.moveDecision={x:0,y:0};
 const plan=cooperativeEngagement(b,bruiser,stats(bruiser),[enemy]);
 assert.ok(plan);assert.equal(plan.mode,'screen');assert.equal(plan.allyId,ranged.id);
 assert.ok(plan.point.x>ranged.x&&plan.point.x<enemy.x,'screen between ally and threat');
 const direction=chooseMovement(b,bruiser,enemy,stats(bruiser),[enemy],STEP);
 assert.ok(direction.x>0);assert.equal(bruiser.supportingAlly,ranged.id);
 assert.equal(bruiser.supportMode,'screen');
 assert.equal(bruiser.focus,null,'support does not change target choice');
});
test('2.12.3 ranged idle ally seeks supporting firing lane without overlapping frontliner',()=>{
 const sides=[{hp:100,squad:[makeChassis('ranged'),makeChassis('bruiser')]},
              {hp:100,squad:[makeChassis('rogue')]}];
 const b=spawn(sides,ARENAS[0],8102),ranged=b.units[0],bruiser=b.units[1],enemy=b.units[2];
 b.time=1;ranged.x=75;ranged.y=180;bruiser.x=210;bruiser.y=200;enemy.x=270;enemy.y=200;
 bruiser.focus=enemy.id;bruiser.attack={phase:'windup'};
 ranged.moveDecision={x:0,y:0};
 const plan=cooperativeEngagement(b,ranged,stats(ranged),[enemy]);
 assert.ok(plan);assert.equal(plan.mode,'support');
 assert.ok(Math.abs(plan.point.y-bruiser.y)>=20,'supporter occupies a separate lane');
 const move=chooseMovement(b,ranged,enemy,stats(ranged),[enemy],STEP);
 assert.ok(move.x>0);assert.equal(ranged.supportingAlly,bruiser.id);
});
test('2.12.3 target identification alone does not recruit allies into a dogpile',()=>{
 const sides=[{hp:100,squad:[makeChassis('bruiser'),makeChassis('ranged')]},
              {hp:100,squad:[makeChassis('rogue')]}];
 const b=spawn(sides,ARENAS[0],8103),u=b.units[0],ally=b.units[1],enemy=b.units[2];
 b.time=1;u.x=150;u.y=200;ally.x=200;ally.y=200;enemy.x=550;enemy.y=200;
 ally.focus=enemy.id;ally.moveDecision={x:0,y:0};
 assert.equal(cooperativeEngagement(b,u,stats(u),[enemy]),null);
});
test('2.12.3 own available attack takes priority over assisting a teammate',()=>{
 const sides=[{hp:100,squad:[makeChassis('bruiser'),makeChassis('ranged')]},
              {hp:100,squad:[makeChassis('rogue')]}];
 const b=spawn(sides,ARENAS[0],8104),u=b.units[0],ally=b.units[1],enemy=b.units[2];
 b.time=1;u.x=250;u.y=200;ally.x=200;ally.y=200;enemy.x=290;enemy.y=200;
 ally.focus=enemy.id;ally.attack={phase:'windup'};
 assert.equal(cooperativeEngagement(b,u,stats(u),[enemy]),null);
});
test('2.12.3 combat commitment and retreat suppress support steering',()=>{
 const sides=[{hp:100,squad:[makeChassis('bruiser'),makeChassis('ranged')]},
              {hp:100,squad:[makeChassis('rogue')]}];
 const b=spawn(sides,ARENAS[0],8105),u=b.units[0],ally=b.units[1],enemy=b.units[2];
 b.time=1;u.x=160;u.y=200;ally.x=200;ally.y=200;enemy.x=310;enemy.y=200;
 ally.focus=enemy.id;ally.attack={phase:'windup'};
 u.disengageUntil=1.3;
 assert.equal(cooperativeEngagement(b,u,stats(u),[enemy]),null);
 u.disengageUntil=0;u.followthroughCommit={until:1.3};
 assert.equal(cooperativeEngagement(b,u,stats(u),[enemy]),null);
});
test('2.12.3 cooperative screen holds do not create false navigation stalls',()=>{
 const sides=[{hp:100,squad:[makeChassis('bruiser'),makeChassis('ranged')]},
              {hp:100,squad:[makeChassis('rogue')]}];
 const b=spawn(sides,ARENAS[0],8106),u=b.units[0],ally=b.units[1],enemy=b.units[2];
 b.time=1;u.x=249;u.y=200;ally.x=200;ally.y=200;enemy.x=310;enemy.y=200;
 ally.focus=enemy.id;ally.attack={phase:'windup'};
 // Source is just outside its own attack reach.
 u.moveDecision={x:0,y:0};
 for(let i=0;i<5;i++){b.time+=.7;chooseMovement(b,u,enemy,stats(u),[enemy],STEP)}
 assert.equal(u.navStuckCount||0,0);
});

test('2.12.3 live multi-fighter combat has independent screens and useful support',()=>{
 const p=[{name:'Team',hp:100,squad:[makeChassis('bruiser'),makeChassis('ranged'),makeChassis('rogue')]},
          {name:'Opponents',hp:100,squad:[makeChassis('bruiser'),makeChassis('ranged')]}];
 const b=spawn(p,ARENAS[0],8261);
 for(const u of b.units){u.x=u.owner?490:150+(u.id%100)*32;u.y=210+(u.id%100)*37;u.cd=0}
 b.diagnostics={units:{}};
 for(let i=0;i<240;i++)if(tick(b,STEP)!==null)break;
 const t=b.diagnostics.tactical;
 assert.ok(t.supportUnitFrames>0,'support must occur in live combat');
 assert.ok(t.screenUnitFrames>0,'durable fighter should screen for ally');
 assert.ok(t.attackReleases>0,'support must not replace fighting');
 assert.ok(t.maxMutualPassiveFrames<90,'cooperation must not create passive standoff');
 assert.ok(Object.values(b.diagnostics.units).some(u=>u.screenFrames>0),'per-unit screen trace exists');
});

test('2.12.3 supporting ally remains a valid commitment after beginning to move',()=>{
 const sides=[{hp:100,squad:[makeChassis('bruiser'),makeChassis('ranged')]},
              {hp:100,squad:[makeChassis('rogue')]}];
 const b=spawn(sides,ARENAS[0],8107),u=b.units[0],ally=b.units[1],enemy=b.units[2];
 b.time=1;u.x=175;u.y=200;ally.x=220;ally.y=200;enemy.x=340;enemy.y=200;
 ally.focus=enemy.id;ally.attack={phase:'windup'};
 u.moveDecision={x:1,y:0};
 u.motion=[{time:.5,x:125,y:200},{time:1,x:175,y:200}];
 u.supportNavigation={allyId:ally.id,enemyId:enemy.id,
  goal:{x:273,y:200},path:[{x:273,y:200}],until:1.25};
 const plan=cooperativeEngagement(b,u,stats(u),[enemy]);
 assert.ok(plan,'moving toward a support point should not cancel the support plan');
 assert.equal(plan.allyId,ally.id);
 const direction=chooseMovement(b,u,enemy,stats(u),[enemy],STEP);
 assert.ok(direction.x>0);assert.equal(u.supportingAlly,ally.id);
});

test('2.12.3 fighters cannot mutually brace just outside actual attack reach',()=>{
 const p=[{hp:100,squad:[makeChassis('bruiser')]},
          {hp:100,squad:[makeChassis('bruiser')]}];
 const b=spawn(p,ARENAS[0],8303),a=b.units[0],enemy=b.units[1];
 b.time=2;a.x=200;a.y=200;enemy.x=262;enemy.y=200;
 a.moveDecision={x:0,y:0};enemy.moveDecision={x:0,y:0};
 a.previouslyHolding=true;enemy.previouslyHolding=true;
 assert.ok(62>stats(a).range,'fixture starts outside attack initiation range');
 assert.equal(holdingOpportunity(b,a,enemy,stats(a),[enemy]),0);
 assert.equal(holdingOpportunity(b,enemy,a,stats(enemy),[a]),0);
 const dir=chooseMovement(b,a,enemy,stats(a),[enemy],STEP);
 assert.ok(dir.x>0,'must advance into actual attack access rather than hold in radius padding');
});

test('2.12.4 movement utility tuning increases distance without affecting Follow Through',()=>{
 assert.equal(UTILITY_MOVE_SCALE,1.3);
 const sample=(type)=>{
  const p=players();p[0].squad=[makeChassis(type)];p[1].squad=[makeChassis('bruiser')];const battle=spawn(p,ARENAS[0],9714);
  const unit=battle.units[0],target=battle.units[1];
  battle.units=[unit,target];unit.x=125;unit.y=200;target.x=315;target.y=200;
  unit.chassis.mods.dash=1;unit.cd=100;target.cd=100;
  tick(battle,STEP);
  const evt=battle.visualEvents.find(e=>e.kind==='mobility'&&e.ability==='dash');
  return evt?Math.hypot(evt.toX-evt.x,evt.toY-evt.y):null;
 };
 const bruiser=sample('bruiser'),rogue=sample('rogue');
 assert.ok(bruiser>0,'Dash still triggers');
 assert.ok(rogue>bruiser,'travel remains chassis speed based; bruiser='+bruiser+' rogue='+rogue);
 assert.ok(bruiser<40&&rogue<90,'travel remains a bounded burst, not a teleport across the arena');
 const battle=spawn(players(),ARENAS[0],9715),attacker=battle.units[0],target=battle.units[1];
 battle.units=[attacker,target];attacker.x=200;attacker.y=200;target.x=245;target.y=200;
 attacker.chassis.mods.followthrough=1;battle.time=.2;
 assert.ok(applyFollowthrough(battle,{source:attacker,target,attackId:972,attackDirection:0}));
 assert.equal(attacker.followthroughCommit.speedFactor,1,'Follow Through movement speed unaffected');
});
test('2.12.4 utility movement still rejects obstructed or out-of-bounds landing',()=>{
 const battle=spawn(players(),ARENAS[1],9716),unit=battle.units[0],target=battle.units[1];
 battle.units=[unit,target];unit.x=252;unit.y=220;target.x=360;target.y=220;
 unit.chassis.mods.dash=1;unit.cd=target.cd=100;
 tick(battle,STEP);
 assert.ok(unit.x<=278-CHASSIS[unit.type].radius-2,'dash cannot enter Twin Pillars');
 assert.ok(Number.isFinite(unit.x)&&Number.isFinite(unit.y));
});
