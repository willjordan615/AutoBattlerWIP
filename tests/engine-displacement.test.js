import test from 'node:test';
import assert from 'node:assert/strict';
import {distance,CHASSIS,ARENAS,STEP,makeChassis,stats,bound,chooseTarget,chooseMovement,holdingOpportunity,cooperativeEngagement,positionScore,clearLine,resolveCollision,tick,spawn,placementGroups,placementDamage,resolvePlayerHP,teamPercent,advanceProjectiles,PROJECTILE_SPEED,utilityCooldown,tacticalAssessment,ATTACK_TIMING,startAttack,advanceAttack,attackMovementMultiplier,meleeAttackTargets,resolveAttackModules,targetScoreDetails,ATTACK_STAGES,claimAttackEffect,applyFollowthrough,advanceFollowthrough,UTILITY_MOVE_SCALE,recentMovement,collisionStability,disengageDirection,resolveFollowthroughImpacts,finishFollowthrough,radiusOf} from '../src/simulation.js';
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
function followFixture(stacks=2,arena=ARENAS[0]){
 const b=spawn(players(),arena,4512),u=b.units[0],target=b.units[1];
 b.units=[u,target];u.type='rogue';u.chassis=makeChassis('rogue');
 u.x=150;u.y=220;target.x=210;target.y=220;u.chassis.mods.followthrough=stacks;b.time=.1;
 return {b,u,target};
}
function completeMove(b,u){const attacks=[];for(let i=0;i<24&&u.followthroughCommit;i++){
 b.time+=STEP;advanceFollowthrough(b,u,STEP);resolveCollision(b);delete u.followthroughStepStart;
 finishFollowthrough(b,u,attacks);
 }return attacks;}
test('3.2.2 Follow Through moves without teleport and ends beside target with one bonus release',()=>{
 const {b,u,target}=followFixture();u.cd=.4;
 assert.ok(applyFollowthrough(b,{source:u,target,attackId:50,attackDirection:0}));
 assert.equal(u.x,150);assert.equal(target.x,210);
 const hits=completeMove(b,u);
 assert.ok(Math.abs(distance(u,target)-(radiusOf(u)+radiusOf(target)+5))<1e-6);
 assert.ok(u.x>target.x);assert.equal(target.x,210);assert.equal(u.cd,.4);
 assert.equal(hits.length,1);assert.equal(hits[0].target,target);assert.ok(hits[0].followthroughBonus);
 assert.equal(u.combatStats.followthroughBonus,1);
 resolveFollowthroughImpacts(b,hits);assert.equal(u.followthroughCommit,null);
 assert.equal(applyFollowthrough(b,{source:u,target,attackId:51}),false,'one second cooldown');
});
test('3.2.2 additional copies improve movement speed, not landing distance',()=>{
 const a=followFixture(2),b=followFixture(3);
 for(const f of [a,b])assert.ok(applyFollowthrough(f.b,{source:f.u,target:f.target,attackId:51,attackDirection:0}));
 assert.ok(b.u.followthroughCommit.speedFactor>a.u.followthroughCommit.speedFactor);
 for(const f of [a,b])completeMove(f.b,f.u);
 assert.ok(Math.abs(a.u.x-b.u.x)<1e-6);
});
test('3.2.2 blocked destinations cannot activate or award a bonus',()=>{
 const {b,u,target}=followFixture(2,ARENAS[1]);
 u.x=245;u.y=200;target.x=450;target.y=200;
 assert.equal(applyFollowthrough(b,{source:u,target,attackId:53,attackDirection:0}),false);
 assert.equal(u.x,245);assert.equal(u.combatStats.followthroughBonus,undefined);
});
test('3.2.2 deepest landed target controls movement and projectile volley waits',()=>{
 const {b,u,target}=followFixture(),far=spawn(players(),ARENAS[0],4516).units[2];
 far.x=235;far.y=220;b.units.push(far);
 const origin={x:150,y:220},attackId=60;
 b.projectiles=[{volley:{attackId}}];
 resolveFollowthroughImpacts(b,[{source:u,target,projectile:true,attackId,damage:10,attackOrigin:origin,attackDirection:0}]);
 assert.equal(u.followthroughCommit,null);
 resolveFollowthroughImpacts(b,[{source:u,target:far,projectile:true,attackId,damage:10,attackOrigin:origin,attackDirection:0}]);
 b.projectiles=[];resolveFollowthroughImpacts(b,[]);
 assert.equal(u.followthroughCommit.targetId,far.id);
 assert.equal(u.x,150);assert.equal(u.combatStats.followthrough,1);
});
test('3.2.2 Disengage begins after Follow Through arrival',()=>{
 const {b,u,target}=followFixture();u.chassis.mods.disengage=1;u.disengageUntil=b.time+.5;
 assert.ok(applyFollowthrough(b,{source:u,target,attackId:70,attackDirection:0}));
 completeMove(b,u);assert.ok(Math.abs(u.disengageUntil-b.time-.5)<1e-8);
});

test('Follow Through near-side arrival grants no bonus',()=>{
 const {b,u,target}=followFixture(1);
 assert.ok(applyFollowthrough(b,{source:u,target,attackId:80,attackDirection:0}));
 const hits=completeMove(b,u);
 assert.ok(Math.abs(distance(u,target)-(radiusOf(u)+radiusOf(target)+5))<=3);
 assert.ok(u.x<target.x);assert.equal(hits.length,0);
 assert.equal(u.lastFollowthroughBonusTargetId,undefined);
});
test('Follow Through lateral landing is not a far-side traversal',()=>{
 const {b,u,target}=followFixture();
 assert.ok(applyFollowthrough(b,{source:u,target,attackId:81,attackDirection:0}));
 u.x=target.x;u.y=target.y+radiusOf(u)+radiusOf(target)+5;
 u.followthroughCommit.arrived=true;
 const hits=[];assert.equal(finishFollowthrough(b,u,hits),false);
 assert.equal(hits.length,0);assert.equal(u.lastFollowthroughBonusTargetId,undefined);
});
test('Follow Through bonuses must alternate targets even after the cooldown',()=>{
 const {b,u,target}=followFixture();
 const other=spawn(players(),ARENAS[0],4516).units[2];b.units.push(other);
 other.x=450;other.y=220;
 assert.ok(applyFollowthrough(b,{source:u,target,attackId:82,attackDirection:0}));
 assert.equal(completeMove(b,u).length,1);
 assert.equal(u.lastFollowthroughBonusTargetId,target.id);
 b.time+=1.1;
 assert.ok(applyFollowthrough(b,{source:u,target,attackId:83,attackDirection:Math.PI}));
 assert.equal(completeMove(b,u).length,0,'same target remains ineligible after cooldown');
 assert.equal(u.lastFollowthroughBonusTargetId,target.id);
 target.x=450;other.x=210;u.x=150;u.y=220;b.time+=1.1;
 assert.ok(applyFollowthrough(b,{source:u,target:other,attackId:84,attackDirection:0}));
 assert.equal(completeMove(b,u).length,1);assert.equal(u.lastFollowthroughBonusTargetId,other.id);
 other.x=450;target.x=210;u.x=150;u.y=220;b.time+=1.1;
 assert.ok(applyFollowthrough(b,{source:u,target,attackId:85,attackDirection:0}));
 assert.equal(completeMove(b,u).length,1);assert.equal(u.lastFollowthroughBonusTargetId,target.id);
});
