import test from 'node:test';
import assert from 'node:assert/strict';
import {distance,CHASSIS,ARENAS,STEP,makeChassis,stats,bound,chooseTarget,chooseMovement,holdingOpportunity,cooperativeEngagement,positionScore,clearLine,resolveCollision,tick,spawn,placementGroups,placementDamage,resolvePlayerHP,teamPercent,advanceProjectiles,PROJECTILE_SPEED,utilityCooldown,tacticalAssessment,ATTACK_TIMING,startAttack,advanceAttack,attackMovementMultiplier,meleeAttackTargets,resolveAttackModules,targetScoreDetails,ATTACK_STAGES,claimAttackEffect,applyFollowthrough,advanceFollowthrough,UTILITY_MOVE_SCALE,recentMovement,collisionStability,disengageDirection,resolveFollowthroughImpacts} from '../src/simulation.js';
import {ATTACK_MODULES,catalog,createMatch,draftPool,assign,legal,canEquip,beginCombat,completeCombat,ensureDraftChoice} from '../src/headless.js';
import {DETAILS,SUMMARIES,cardDetail,cardSummary} from '../src/module-info.js';
import {players,projectileFixture,testShot} from './simulation-fixtures.js';

test('2.11 impact and aftermath modules reflect their persistent versus immediate roles',()=>{
 for(const k of ['taunt','sunder','disruption','expose','burning','hazardous','disengage'])
  assert.equal(ATTACK_STAGES[k].stage,'aftermath',k);
 for(const k of ['knockback','followthrough'])assert.equal(ATTACK_STAGES[k].stage,'impact',k);
 assert.ok(ATTACK_MODULES.includes('disengage'));
 assert.ok(ATTACK_MODULES.includes('followthrough'));
 assert.ok(!catalog.some(c=>c.kind==='utility'&&['disengage','followthrough'].includes(c.key)));
 assert.ok(canEquip(makeChassis('ranged'),{kind:'attack',key:'followthrough'}));
 assert.ok(canEquip(makeChassis('rogue'),{kind:'attack',key:'followthrough'}));
});
test('2.11 Disengage starts on committed release and suppresses attacks during half-second retreat',()=>{
 const b=spawn(players(),ARENAS[0],3203),a=b.units[0],target=b.units[1];
 b.units=[a,target];a.x=200;a.y=220;target.x=245;target.y=220;
 a.type='rogue';a.chassis.type='rogue';a.chassis.mods.disengage=1;
 a.cd=0;target.cd=1000;
 let started=false;
 for(let step=0;step<40;step++){
  tick(b,STEP);
  if(a.disengageUntil>b.time){started=true;break}
 }
 assert.ok(started,'attack release should activate retreat');
 const until=a.disengageUntil,startX=a.x,attacks=a.combatStats.attacks;
 for(let step=0;step<10;step++)tick(b,STEP);
 assert.ok(a.x<startX,'fighter actually retreats instead of simply increasing a score');
 assert.equal(a.combatStats.attacks,attacks,'no attack during forced retreat');
 assert.ok(a.disengageUntil<=until);
 for(let step=0;step<10;step++)tick(b,STEP);
 assert.equal(a.disengageUntil,0,'retreat expires and resets targeting');
});
test('2.11 retreat direction favors separation and stronger stacks increase speed without duration',()=>{
 const b=spawn(players(),ARENAS[0],3204),a=b.units[0],target=b.units[1];
 b.units=[a,target];a.x=200;a.y=200;target.x=240;target.y=200;
 a.chassis.mods.disengage=3;
 const d=disengageDirection(b,a,[target]);
 assert.ok(d.x<-.8,'retreat direction should lead away from threat');
 assert.equal(ATTACK_STAGES.disengage.duration,.5);
});


test('2.12 bracing comes from actual recent motion and maximum HP',()=>{
 const b=spawn(players(),ARENAS[0],4510),u=b.units[0];b.time=1;
 u.motion=[{time:.5,x:120,y:120},{time:.75,x:120.5,y:120},{time:1,x:121,y:120}];
 const planted=collisionStability(u,b.time);
 assert.ok(Math.abs(planted-u.maxHp*1.5)<1e-5);
 u.motion=[{time:.5,x:120,y:120},{time:.75,x:130,y:120},{time:1,x:144,y:120}];
 const moving=collisionStability(u,b.time);
 assert.ok(moving>planted);
 assert.ok(Math.abs(recentMovement(u,b.time)-24)<1e-8);
 u.hp=1;
 assert.equal(collisionStability(u,b.time),moving,'remaining HP does not alter mass');
});
test('2.12 collision stability changes yield without introducing immovable braces',()=>{
 const b=spawn(players(),ARENAS[0],4511),a=b.units[0],enemy=b.units[1];
 b.units=[a,enemy];a.x=200;a.y=200;enemy.x=219;enemy.y=200;
 a.maxHp=155;enemy.maxHp=80;b.time=1;
 a.motion=[{time:.5,x:200,y:200},{time:1,x:200,y:200}];
 enemy.motion=[{time:.5,x:195,y:200},{time:1,x:219,y:200}];
 const ax=a.x,bx=enemy.x;
 resolveCollision(b);
 assert.ok(Math.abs(a.x-ax)<Math.abs(enemy.x-bx),'higher-stability brace yields less');
 assert.ok(Math.abs(a.x-ax)>0,'brace can still be moved');
 assert.ok(distance(a,enemy)>=CHASSIS[a.type].radius+CHASSIS[enemy.type].radius+4);
});
test('2.12 Follow Through creates half-second commitment, not instant teleport',()=>{
 const b=spawn(players(),ARENAS[0],4512),u=b.units[0],target=b.units[1];
 b.units=[u,target];u.type='rogue';u.chassis=makeChassis('rogue');
 u.chassis.mods.followthrough=1;u.x=150;u.y=200;target.x=300;target.y=200;b.time=.2;
 assert.equal(applyFollowthrough(b,{source:u,target,attackId:50,attackDirection:0}),true);
 assert.equal(u.x,150,'impact does not teleport');
 const cap=stats(u).speed*.5;
 let traveled=0;
 for(let i=1;i<=15;i++){
  b.time=.2+i*STEP;
  const start=u.x;advanceFollowthrough(b,u,STEP);resolveCollision(b);
  traveled+=u.x-start;
 }
 assert.ok(traveled>cap*.85);
 assert.ok(traveled<=cap+1e-5,'speed x commitment time is hard travel budget');
 assert.ok(u.x<target.x,'faraway target cannot induce a teleport');
 assert.equal(applyFollowthrough(b,{source:u,target,attackId:50}),false);
});
test('2.12 Follow Through stacks scale movement speed rather than teleport distance',()=>{
 const b=spawn(players(),ARENAS[0],4513),u=b.units[0],target=b.units[1];
 b.units=[u,target];u.x=100;u.y=100;target.x=500;target.y=100;b.time=.1;
 u.chassis.mods.followthrough=3;
 assert.ok(applyFollowthrough(b,{source:u,target,attackId:51,attackDirection:0}));
 b.time=.1+STEP;advanceFollowthrough(b,u,STEP);
 assert.ok(Math.abs((u.x-100)-stats(u).speed*(1+.60)*STEP)<1e-6);
});
test('2.12 a Follow Through push shares displacement with a braced fighter',()=>{
 const b=spawn(players(),ARENAS[0],4514),u=b.units[0],target=b.units[1];
 b.units=[u,target];u.x=200;u.y=200;target.x=226;target.y=200;b.time=.2;
 u.chassis.mods.followthrough=1;
 u.motion=[{time:0,x:199,y:200},{time:.2,x:200,y:200}];
 target.motion=[{time:0,x:226,y:200},{time:.2,x:226,y:200}];
 assert.ok(applyFollowthrough(b,{source:u,target,attackId:52,attackDirection:0}));
 const prior=target.x;
 b.time+=STEP;advanceFollowthrough(b,u,STEP);resolveCollision(b);
 assert.ok(target.x>prior,'braced defender yields some ground');
 assert.ok(target.x-prior<CHASSIS[target.type].radius,'contact does not teleport defender');
});
test('2.12 committed Follow Through is blocked by solid terrain',()=>{
 const b=spawn(players(),ARENAS[1],4515),u=b.units[0],target=b.units[1];
 b.units=[u,target];u.x=245;u.y=200;target.x=450;target.y=200;
 u.chassis.mods.followthrough=1;b.time=.1;
 assert.ok(applyFollowthrough(b,{source:u,target,attackId:53,attackDirection:0}));
 const start=u.x;
 for(let i=0;i<20;i++){b.time+=STEP;advanceFollowthrough(b,u,STEP);resolveCollision(b)}
 assert.ok(u.x<278-CHASSIS[u.type].radius,'cannot pass into a pillar');
 assert.ok(u.x>=start);
});
test('2.12 deepest successful target controls direction, not attack processing order',()=>{
 const b=spawn(players(),ARENAS[0],4516),u=b.units[0],a=b.units[1],far=b.units[2];
 b.units=[u,a,far];u.chassis.mods.followthrough=1;u.x=120;u.y=220;
 a.x=170;a.y=220;far.x=190;far.y=238;
 const origin={x:120,y:220},direction=.1;b.time=.1;
 resolveFollowthroughImpacts(b,[
  {source:u,target:far,attackId:60,damage:10,attackOrigin:origin,attackDirection:direction},
  {source:u,target:a,attackId:60,damage:10,attackOrigin:origin,attackDirection:direction}
 ]);
 assert.ok(u.followthroughCommit);
 assert.equal(u.combatStats.followthrough,1);
 assert.ok(Math.abs(u.followthroughCommit.x-Math.cos(direction))<1e-8);
 assert.equal(u.x,120,'no immediate jump after multi-hit release');
});
test('2.12 projectile volley waits for its final impact before initiating commitment',()=>{
 const b=spawn(players(),ARENAS[0],4517),u=b.units[0],a=b.units[1],far=b.units[2];
 b.units=[u,a,far];u.type='ranged';u.chassis=makeChassis('ranged');
 u.chassis.mods.followthrough=1;u.x=120;u.y=240;a.x=170;a.y=240;far.x=210;far.y=240;
 const origin={x:120,y:240},attackId=61;b.time=.1;
 b.projectiles=[{volley:{attackId}}];
 resolveFollowthroughImpacts(b,[{source:u,target:a,projectile:true,attackId,damage:10,attackOrigin:origin,attackDirection:0}]);
 assert.equal(u.followthroughCommit,null);
 resolveFollowthroughImpacts(b,[{source:u,target:far,projectile:true,attackId,damage:10,attackOrigin:origin,attackDirection:0}]);
 b.projectiles=[];resolveFollowthroughImpacts(b,[]);
 assert.ok(u.followthroughCommit);
 assert.equal(u.x,120);
 assert.equal(u.combatStats.followthrough,1);
});

test('2.12 Follow Through and Disengage resolve sequentially, without cancelling either module',()=>{
 const b=spawn(players(),ARENAS[0],4518),u=b.units[0],target=b.units[1];
 b.units=[u,target];u.chassis.mods.followthrough=1;u.chassis.mods.disengage=1;
 u.x=120;u.y=220;target.x=260;target.y=220;b.time=.2;
 u.disengageUntil=b.time+.5;
 assert.ok(applyFollowthrough(b,{source:u,target,attackId:70,attackDirection:0}));
 assert.ok(Math.abs(u.disengageUntil-(b.time+1))<1e-8);
 assert.ok(u.followthroughCommit.until<b.time+.6);
});
test('2.12 Follow Through movement never exceeds speed-scaled commitment budget even with collision',()=>{
 const b=spawn(players(),ARENAS[0],4519),u=b.units[0],enemy=b.units[1];
 b.units=[u,enemy];u.type='rogue';u.chassis=makeChassis('rogue');
 u.chassis.mods.followthrough=1;u.x=150;u.y=220;enemy.x=205;enemy.y=220;
 b.time=.1;assert.ok(applyFollowthrough(b,{source:u,target:enemy,attackId:71,attackDirection:0}));
 const start=u.x;
 for(let i=0;i<15;i++){b.time+=STEP;advanceFollowthrough(b,u,STEP);resolveCollision(b)}
 const cap=stats(u).speed*.5;
 assert.ok(u.x-start<=cap+2,'contact does not create a far-side teleport');
 assert.ok(enemy.x>205,'fighter yields space during committed contact');
});

test('3.2 two Follow Through copies let a full-speed rogue clear a stationary bruiser from normal reach',()=>{
 const b=spawn(players(),ARENAS[0],4520),u=b.units.find(u=>u.type==='rogue'),target=b.units.find(u=>u.type==='bruiser');
 b.units=[u,target];u.x=150;u.y=220;target.x=210;target.y=220;b.time=.1;
 u.chassis.mods.followthrough=2;
 assert.ok(applyFollowthrough(b,{source:u,target,attackId:72,attackDirection:0}));
 for(let i=1;i<=24;i++){
  b.time=.1+i*STEP;advanceFollowthrough(b,u,STEP);resolveCollision(b);delete u.followthroughStepStart;
 }
 assert.ok(u.x>=target.x+CHASSIS.rogue.radius+CHASSIS.bruiser.radius+5-1e-6);
 assert.equal(target.x,210);
});
