import test from 'node:test';
import assert from 'node:assert/strict';
import {CHASSIS,ARENAS,STEP,makeChassis,stats,bound,chooseTarget,chooseMovement,holdingOpportunity,cooperativeEngagement,positionScore,clearLine,resolveCollision,tick,spawn,placementGroups,placementDamage,resolvePlayerHP,teamPercent,advanceProjectiles,PROJECTILE_SPEED,utilityCooldown,tacticalAssessment,ATTACK_TIMING,startAttack,advanceAttack,attackMovementMultiplier,meleeAttackTargets,resolveAttackModules,targetScoreDetails,ATTACK_STAGES,claimAttackEffect,applyFollowthrough,advanceFollowthrough,UTILITY_MOVE_SCALE,recentMovement,collisionStability,disengageDirection,resolveFollowthroughImpacts} from '../src/simulation.js';
import {ATTACK_MODULES,catalog,createMatch,draftPool,assign,legal,canEquip,beginCombat,completeCombat,ensureDraftChoice} from '../src/headless.js';
import {DETAILS,SUMMARIES,cardDetail,cardSummary} from '../src/module-info.js';
import {players,projectileFixture,testShot} from './simulation-fixtures.js';

test('movement decisions are weight-driven, not chassis hardcoded',()=>{
 const p=players();const b=spawn(p);
 b.units=b.units.slice(0,2);const a=b.units[0],enemy=b.units[1];
 a.x=200;a.y=200;enemy.x=260;enemy.y=200;
 for(const key of Object.keys(a.chassis.weights))a.chassis.weights[key]=0;
 a.chassis.weights.distance=12;
 const approach=chooseMovement(b,a,enemy,stats(a),[enemy],STEP);
 a.chassis.weights.distance=0;a.chassis.weights.safety=12;
 const retreat=chooseMovement(b,a,enemy,stats(a),[enemy],STEP);
 assert.ok(approach.x>0,'distance weight encourages approaching');
 assert.ok(retreat.x<0,'safety weight encourages retreating');
});
test('the same weights can make a ranged chassis aggressive',()=>{
 const p=players();p[0].squad=[makeChassis('ranged')];const b=spawn(p);
 b.units=b.units.filter(u=>u.owner===0||u.owner===1).slice(0,2);
 const a=b.units.find(u=>u.owner===0),enemy=b.units.find(u=>u.owner===1);
 a.x=200;a.y=200;enemy.x=315;enemy.y=200;
 for(const key of Object.keys(a.chassis.weights))a.chassis.weights[key]=0;
 a.chassis.weights.distance=12;
 assert.ok(chooseMovement(b,a,enemy,stats(a),[enemy],STEP).x>0);
});


test('navigation follows a persistent detour around a pillar',()=>{
 const b=spawn(players(),ARENAS[1]);b.units=b.units.slice(0,2);
 const a=b.units[0],enemy=b.units[1];a.x=259.68;a.y=258.91;enemy.x=336.02;enemy.y=233.73;
 let moved=0,engaged=false;
 for(let i=0;i<300;i++){
  b.time+=STEP;const old={x:a.x,y:a.y},st=stats(a);
  const dir=chooseMovement(b,a,enemy,st,[enemy],STEP);
  a.x+=dir.x*st.speed*STEP;a.y+=dir.y*st.speed*STEP;bound(a,b.arena);
  moved+=Math.hypot(a.x-old.x,a.y-old.y);
  engaged ||=clearLine(a,enemy,b.arena)&&Math.hypot(a.x-enemy.x,a.y-enemy.y)<=st.range;
 }
 assert.ok(moved>30,'obstructed fighter should navigate around the pillar');
 assert.ok(engaged,'fighter should reach a real firing position, not just inflated-wall visibility');
});
test('navigation can step away from target to round a barrier',()=>{
 const b=spawn(players(),ARENAS[2]);b.units=b.units.slice(0,2);
 const a=b.units[0],enemy=b.units[1];a.x=317;a.y=199;enemy.x=400;enemy.y=200;
 const d=chooseMovement(b,a,enemy,stats(a),[enemy],STEP);
 assert.ok(d.x!==0||d.y!==0,'must choose a physical detour rather than idle');
});

test('approaching enemies lower predicted safety',()=>{
 const b=spawn(players());const u=b.units.find(x=>x.type==='ranged'),e=b.units.find(x=>x.owner!==u.owner);
 b.units=[u,e];u.x=200;u.y=200;e.x=335;e.y=200;
 e.intent={x:1,y:0};const leaving=positionScore(b,u,e,u,stats(u),[e]);
 e.intent={x:-1,y:0};const approaching=positionScore(b,u,e,u,stats(u),[e]);
 assert.ok(approaching<leaving,'approaching enemy should lower safety');
});
test('high-safety ally gives room to lower-safety frontline ally',()=>{
 const p=players();p[0].squad=[makeChassis('ranged'),makeChassis('bruiser')];
 const b=spawn(p),u=b.units.find(x=>x.owner===0&&x.type==='ranged'),ally=b.units.find(x=>x.owner===0&&x.type==='bruiser'),e=b.units.find(x=>x.owner===1);
 b.units=[u,ally,e];u.x=200;u.y=200;ally.x=219;ally.y=200;e.x=350;e.y=200;
 ally.intent={x:-1,y:0};
 const near=positionScore(b,u,e,{x:203,y:200},stats(u),[e]);
 const away=positionScore(b,u,e,{x:197,y:200},stats(u),[e]);
 assert.ok(away>near,'cautious unit should yield to the frontline');
});
test('ranged preferred distance beats closing to point blank',()=>{
 const b=spawn(players());const u=b.units.find(x=>x.type==='ranged'),e=b.units.find(x=>x.owner!==u.owner);
 b.units=[u,e];u.x=200;u.y=200;e.x=250;e.y=200;
 const close=positionScore(b,u,e,{x:215,y:200},stats(u),[e]);
 const retreat=positionScore(b,u,e,{x:185,y:200},stats(u),[e]);
 assert.ok(retreat>close,'ranged unit should favor retreat toward firing distance');
});

test('corner recovery routes a ranged fighter to actual engagement around central barrier',()=>{
 const b=spawn(players(),ARENAS[2],101);b.units=b.units.slice(0,2);
 const a=b.units[0],enemy=b.units[1];
 a.x=315;a.y=200;enemy.x=420;enemy.y=200;
 a.chassis=makeChassis('ranged');a.type='ranged';
 let engaged=false;
 for(let i=0;i<300;i++){
  b.time+=STEP;
  const dir=chooseMovement(b,a,enemy,stats(a),[enemy],STEP);
  a.x+=dir.x*stats(a).speed*STEP;a.y+=dir.y*stats(a).speed*STEP;
  bound(a,b.arena);
  if(clearLine(a,enemy,b.arena)&&Math.hypot(a.x-enemy.x,a.y-enemy.y)<=stats(a).range){engaged=true;break}
 }
 assert.ok(engaged,'ranged fighter must gain a firing position instead of orbiting the barrier');
});
test('route progress detector reacts to persistent, simulated immobility',()=>{
 const b=spawn(players(),ARENAS[2],103);b.units=b.units.slice(0,2);
 const a=b.units[0],enemy=b.units[1];a.x=315;a.y=200;enemy.x=420;enemy.y=200;
 for(let i=0;i<95;i++){b.time+=STEP;chooseMovement(b,a,enemy,stats(a),[enemy],STEP)}
 assert.ok((a.navStuckCount||0)>=1,'stationary fighter should trigger route recovery after repeated progress windows');
});
test('moving teammate influences obstacle-aware steering without freezing the fighter',()=>{
 const p=players();p[0].squad=[makeChassis('bruiser'),makeChassis('bruiser')];
 const b=spawn(p,ARENAS[1],137);
 const units=b.units.filter(u=>u.owner===0),enemy=b.units.find(u=>u.owner===1);
 b.units=[...units,enemy];
 const [a,ally]=units;
 a.x=245;a.y=225;ally.x=263;ally.y=225;enemy.x=365;enemy.y=225;
 ally.intent={x:0,y:-1};
 const decision=chooseMovement(b,a,enemy,stats(a),[enemy],STEP);
 assert.ok(Number.isFinite(decision.x)&&Number.isFinite(decision.y));
 assert.ok(decision.x!==0||decision.y!==0,'dynamic actor should not force complete inaction');
});

test('opt-in diagnostics capture movement and attacks without changing simulation results',()=>{
 const make=()=>{const b=spawn(players(),ARENAS[1],211);b.units=b.units.slice(0,2);return b};
 const plain=make(),instrumented=make();instrumented.diagnostics={units:{}};
 for(let i=0;i<120;i++){tick(plain,STEP);tick(instrumented,STEP)}
 assert.deepEqual(instrumented.units.map(u=>[u.x,u.y,u.hp]),plain.units.map(u=>[u.x,u.y,u.hp]));
 const records=Object.values(instrumented.diagnostics.units);
 assert.ok(records.length>0);
 assert.ok(records.every(r=>r.frames>0&&Number.isFinite(r.actual)&&Number.isFinite(r.replans)));
});

test('wall-bound correction does not pull a clear unit back into a corner',()=>{
 const arena=ARENAS[1],u={type:'bruiser',x:337.5,y:158.0};
 const old={x:u.x,y:u.y};bound(u,arena);
 assert.ok(Math.hypot(u.x-old.x,u.y-old.y)<1e-8,
  'physical clearance between radius and radius+2 must not trigger a backwards snap');
});

test('all chassis reach stationary targets around both obstacle layouts',()=>{
 for(const arena of ARENAS.slice(1))for(const type of Object.keys(CHASSIS)){
  const p=[{name:'A',hp:100,squad:[makeChassis(type)]},{name:'B',hp:100,squad:[makeChassis('bruiser')]}];
  const b=spawn(p,arena,101),a=b.units[0],target=b.units[1];
  a.x=arena===ARENAS[1]?255:315;a.y=arena===ARENAS[1]?215:200;
  target.x=arena===ARENAS[1]?360:420;target.y=a.y;
  let achieved=false;
  for(let i=0;i<300;i++){
   b.time+=STEP;const st=stats(a);
   const dir=chooseMovement(b,a,target,st,[target],STEP);
   a.x+=dir.x*st.speed*STEP;a.y+=dir.y*st.speed*STEP;bound(a,arena);
   if(clearLine(a,target,arena)&&Math.hypot(a.x-target.x,a.y-target.y)<=st.range){achieved=true;break}
  }
  assert.ok(achieved,arena.name+' '+type+' should find a firing position within 10 seconds');
 }
});
