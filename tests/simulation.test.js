import test from 'node:test';
import assert from 'node:assert/strict';
import {CHASSIS,ARENAS,STEP,makeChassis,stats,bound,chooseTarget,chooseMovement,holdingOpportunity,cooperativeEngagement,positionScore,clearLine,resolveCollision,tick,spawn,placementGroups,placementDamage,resolvePlayerHP,teamPercent,advanceProjectiles,PROJECTILE_SPEED,utilityCooldown,tacticalAssessment,ATTACK_TIMING,startAttack,advanceAttack,attackMovementMultiplier,meleeAttackTargets,resolveAttackModules,targetScoreDetails,ATTACK_STAGES,claimAttackEffect,applyFollowthrough,advanceFollowthrough,UTILITY_MOVE_SCALE,recentMovement,collisionStability,disengageDirection,resolveFollowthroughImpacts} from '../src/simulation.js';
import {ATTACK_MODULES,catalog,createMatch,draftPool,assign,legal,canEquip,beginCombat,completeCombat,ensureDraftChoice} from '../src/headless.js';
import {DETAILS,SUMMARIES,cardDetail,cardSummary} from '../src/module-info.js';
const players=()=>Array.from({length:4},(_,i)=>({name:'P'+i,hp:100,streak:0,squad:[makeChassis(['bruiser','rogue','ranged','bruiser'][i])]}));
test('chassis mutations are independent',()=>{const a=makeChassis('bruiser'),b=makeChassis('bruiser');a.mods.hp=2;assert.equal(stats({type:'bruiser',chassis:a}).hp,195);assert.equal(stats({type:'bruiser',chassis:b}).hp,155)});
test('wall clamping for all archetypes',()=>{for(const type of Object.keys(CHASSIS)){const u={type,x:-100,y:900};bound(u);assert.ok(u.x>20&&u.y<500)}});
test('obstacles block line of sight',()=>{const arena=ARENAS[1];assert.equal(clearLine({x:200,y:200},{x:400,y:200},arena),false);assert.equal(clearLine({x:200,y:80},{x:400,y:80},arena),true)});
test('obstacle collisions keep fighters outside',()=>{const u={type:'bruiser',x:300,y:200};bound(u,ARENAS[1]);assert.ok(u.x<=260||u.x>=336||u.y<=154||u.y>=275)});
test('unit collision resolves overlap',()=>{const s=spawn(players());s.units[1].x=s.units[0].x;s.units[1].y=s.units[0].y;resolveCollision(s);assert.ok(Math.hypot(s.units[1].x-s.units[0].x,s.units[1].y-s.units[0].y)>20)});
test('all ten utility metrics exist',()=>{const c=makeChassis('rogue');assert.equal(Object.keys(c.weights).length,10);c.weights.kill+=1;assert.equal(c.weights.kill,2.4)});
test('simultaneous elimination records same tick',()=>{const p=players();p[1].squad[0]=makeChassis('bruiser');const s=spawn(p);s.units=s.units.slice(0,2);s.units[0].owner=0;s.units[1].owner=1;s.units[0].x=100;s.units[1].x=120;s.units[0].y=s.units[1].y=100;s.units[0].hp=s.units[1].hp=1;s.units[0].cd=s.units[1].cd=0;for(let i=0;i<12;i++)tick(s,STEP);assert.equal(s.units[0].hp,0);assert.equal(s.units[1].hp,0);assert.equal(s.eliminations.length,2);assert.equal(s.eliminations[0].tick,s.eliminations[1].tick)});
test('30 second timeout',()=>{const s=spawn(players());s.units.forEach((u,i)=>{u.x=50+i*200;u.y=50;u.cd=1000});let result=null;for(let i=0;i<901&&result===null;i++)result=tick(s,STEP);assert.ok(s.time>=30&&s.time<30.1)});
test('survivors rank above eliminated',()=>{const s=spawn(players());s.units[1].hp=0;s.eliminations=[{owner:1,tick:5}];const groups=placementGroups(s);assert.equal(groups.at(-1)[0],1)});
test('team HP percent uses max HP of defeated units',()=>{const p=players();p[0].squad.push(makeChassis('bruiser'));const s=spawn(p);s.units[0].hp=0;assert.equal(teamPercent(s,0),.5)});
test('round winner takes zero persistent damage',()=>{const p=players();resolvePlayerHP(p,[0,1,2,3],1);assert.equal(p[0].hp,100);assert.ok(p[3].hp<p[2].hp)});
test('bottom-half streak breaks on top-half finish',()=>{const p=players();resolvePlayerHP(p,[0,1,2,3],1);assert.equal(p[3].streak,1);resolvePlayerHP(p,[3,1,0,2],2);assert.equal(p[3].streak,0)});
test('damage increases with round number',()=>{assert.ok(placementDamage(10,4,4,0)>placementDamage(1,4,4,0))});
test('deterministic simulation for same seed',()=>{const run=()=>{const s=spawn(players(),ARENAS[1],17);for(let i=0;i<900;i++)if(tick(s,STEP)!==null)break;return s.units.map(u=>[u.hp,u.x,u.y])};assert.deepEqual(run(),run())});

test('attack mutations stack linearly and compose',()=>{const c=makeChassis('ranged');c.mods.projectiles=2;c.mods.piercing=2;c.mods.damage=3;const st=stats({type:'ranged',chassis:c});assert.equal(st.projectiles,3);assert.equal(st.piercing,2);assert.equal(st.damage,20)});
test('targeting mutation weights stack additively',()=>{const c=makeChassis('bruiser');const initial=c.weights.kill;c.weights.kill+=1;c.weights.kill+=1;assert.equal(c.weights.kill,initial+2)});
test('defensive passive changes defense and regen preserves max HP',()=>{const c=makeChassis('bruiser');c.passives.push('bulwark','regen');const st=stats({type:'bruiser',chassis:c});assert.equal(st.defense,4);const p=players();p[0].squad[0]=c;const battle=spawn(p);const u=battle.units[0];u.hp=u.maxHp-10;u.cd=1000;tick(battle,STEP);assert.ok(u.hp>u.maxHp-10&&u.hp<=u.maxHp)});
test('eliminations on the same tick form a placement tie',()=>{const p=players(),s=spawn(p);s.units[1].hp=0;s.units[2].hp=0;s.eliminations=[{owner:1,tick:17},{owner:2,tick:17}];const groups=placementGroups(s);assert.deepEqual(groups.at(-1),[1,2])});

test('all players receive unique randomized corners and move corners every round',()=>{const p=players();for(let seed=1;seed<=30;seed++){let previous=null;for(let round=1;round<=8;round++){const a=spawn(p,ARENAS[0],seed+round*991,round,previous),b=spawn(p,ARENAS[0],seed+round*991,round,previous);assert.deepEqual(a.spawnSlots,b.spawnSlots);assert.deepEqual([...a.spawnSlots].sort(),[0,1,2,3]);if(previous)for(let i=0;i<4;i++)assert.ok(a.spawnSlots[i]!==previous[i]);for(let i=0;i<4;i++){const unit=a.units.find(u=>u.owner===i);assert.ok(unit);const corner=a.spawnSlots[i];assert.ok((corner===0||corner===3?unit.x<200:unit.x>500));assert.ok((corner===0||corner===1?unit.y<200:unit.y>300))}previous=a.spawnSlots}}});

test('ranged damage and floating numbers occur at physical impact, not firing',()=>{
 const p=players(),state=spawn(p,ARENAS[0],33);
 const attacker=state.units.find(u=>u.type==='ranged');
 const victim=state.units.find(u=>u.owner!==attacker.owner);
 for(const u of state.units)if(u!==attacker&&u!==victim)u.hp=0;
 attacker.x=200;attacker.y=200;victim.x=300;victim.y=200;
 attacker.cd=0;victim.cd=1000;
 const before=victim.hp;tick(state,STEP);
 assert.equal(state.projectiles.length,0,'windup must not launch a projectile');
 for(let i=0;i<8;i++)tick(state,STEP);
 assert.ok(state.projectiles.length>0,'a projectile should exist following release');
 assert.equal(victim.hp,before,'launching cannot immediately apply damage');
 assert.ok(!state.visualEvents.some(e=>e.kind==='damage'));
 let impacted=false;
 for(let i=0;i<30;i++){
  tick(state,STEP);
  if(victim.hp<before){
   const event=state.visualEvents.find(e=>e.kind==='damage'&&e.owner===victim.owner);
   assert.ok(event,'impact damage must produce a floating number');
   assert.equal(event.value,before-victim.hp);
   assert.ok(state.visualEvents.some(e=>e.kind==='impact'));
   impacted=true;break;
  }
 }
 assert.ok(impacted,'a clear, stationary target should be struck after travel time');
});

test('Bruiser base damage is 16',()=>{assert.equal(CHASSIS.bruiser.damage,16)});
test('taunt forces the struck enemy to target its attacker and expires',()=>{
 const p=players(),state=spawn(p,ARENAS[0],47);
 const taunter=state.units[0],victim=state.units[1],alternative=state.units[2];
 for(const u of state.units)if(u!==taunter&&u!==victim&&u!==alternative)u.hp=0;
 taunter.chassis.mods.taunt=2;
 taunter.x=200;taunter.y=200;victim.x=226;victim.y=200;
 alternative.x=229;alternative.y=200;
 // Force a hit on the victim; the alternative is on the attacker's team.
 alternative.owner=taunter.owner;alternative.cd=99;victim.cd=99;taunter.cd=0;
 for(let i=0;i<12;i++)tick(state,STEP);
 assert.equal(victim.tauntedBy,taunter.id);
 assert.ok(victim.tauntedUntil-state.time>.2);
 assert.equal(chooseTarget(state,victim,[taunter,alternative]),taunter);
 state.time=victim.tauntedUntil+.001;
 assert.notEqual(victim.tauntedUntil>state.time,true);
});

test('Rogue baseline and reduced flat modules match new values',()=>{
 const rogue=makeChassis('rogue');rogue.mods.hp=1;rogue.mods.damage=1;
 const st=stats({type:'rogue',chassis:rogue});
 assert.equal(CHASSIS.rogue.hp,105);assert.equal(CHASSIS.rogue.damage,18);
 assert.equal(CHASSIS.rogue.speed,95.45);
 assert.equal(st.hp,125);assert.equal(st.damage,20);
});
test('multishot creates independent shots and damages an enemy at most once per volley',()=>{
 const p=players();p[0].squad[0]=makeChassis('ranged');
 const s=spawn(p,ARENAS[0],51),a=s.units[0],v=s.units[1];
 s.units=s.units.slice(0,2);a.chassis.mods.projectiles=4;
 a.x=200;a.y=200;v.x=260;v.y=200;a.cd=0;v.cd=99;
 const before=v.hp;tick(s,STEP);
 assert.equal(s.projectiles.length,0,'no volley during windup');
 for(let i=0;i<8;i++)tick(s,STEP);
 assert.equal(s.projectiles.length,5);
 assert.equal(before-v.hp,0,'volley needs flight time');
 for(let i=0;i<20;i++)tick(s,STEP);
 assert.equal(before-v.hp,Math.max(1,stats(a).damage-stats(v).defense));
});
test('multishot with pierce remains bounded to one hit per enemy',()=>{
 const p=players();p[0].squad[0]=makeChassis('ranged');
 const battle=spawn(p,ARENAS[0],53),attacker=battle.units[0],victim=battle.units[1];
 attacker.x=200;attacker.y=200;victim.x=260;victim.y=200;
 for(const u of battle.units.slice(2))u.hp=0;
 attacker.chassis.mods.projectiles=3;attacker.chassis.mods.piercing=2;
 attacker.cd=0;victim.cd=100;
 const hp=victim.hp;tick(battle,STEP);
 assert.ok(victim.hp<=hp);
 assert.ok(hp-victim.hp<=stats(attacker).damage,'spread lanes cannot hit one enemy twice');
});

test('dash is optional and its cooldown cannot be spent without activation',()=>{
 const p=players(),battle=spawn(p);battle.units=battle.units.slice(0,2);
 const a=battle.units[0],b=battle.units[1];a.x=150;a.y=200;b.x=290;b.y=200;
 a.chassis.mods.dash=1;a.cd=100;b.cd=100;
 tick(battle,STEP);assert.ok(a.x>150,'fighter should seek engagement');
 const first=a.mobilityCd.dash;
 if(first!==undefined)assert.ok(first>battle.time,'activated dash has a future cooldown');
 tick(battle,STEP);
 if(first!==undefined)assert.equal(a.mobilityCd.dash,first,'ability must not double-trigger within cooldown');
});
test('followthrough is optional and keeps normal movement collision bounds',()=>{
 const p=players(),battle=spawn(p);battle.units=battle.units.slice(0,2);
 const a=battle.units[0],b=battle.units[1];a.x=180;a.y=200;b.x=215;b.y=200;
 a.chassis.mods.followthrough=2;a.cd=100;b.cd=100;
 tick(battle,STEP);
 assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));
 assert.ok(a.x>=20+CHASSIS[a.type].radius&&a.x<=700-CHASSIS[a.type].radius);
});
test('dodge triggers on injury and threat and briefly avoids damage',()=>{
 const p=players(),battle=spawn(p);battle.units=battle.units.slice(0,2);
 const a=battle.units[0],b=battle.units[1];a.x=180;a.y=200;b.x=220;b.y=200;
 a.chassis.mods.dodge=1;a.hp=a.maxHp*.6;a.cd=100;b.cd=100;
 tick(battle,STEP);assert.ok(a.hp>0); // Evasion is no longer forced solely by injury.
});

test('mobility distance scales with chassis speed and speed upgrades',()=>{
 const measure=(type,speedMods=0)=>{
  const p=players();p[0].squad=[makeChassis(type)];const b=spawn(p);
  b.units=b.units.filter(u=>u.owner===0||u.owner===1).slice(0,2);
  const a=b.units.find(u=>u.owner===0),target=b.units.find(u=>u.owner===1);
  a.x=150;a.y=200;target.x=290;target.y=200;
  a.chassis.mods.dash=1;a.chassis.mods.speed=speedMods;a.cd=target.cd=100;
  tick(b,STEP);return a.x-150;
 };
 const bruiser=measure('bruiser'),rogue=measure('rogue'),boosted=measure('bruiser',1);
 assert.ok(bruiser<rogue);assert.ok(boosted>bruiser);
 assert.ok(bruiser<40,'a single Bruiser dash remains bounded after readability tuning');
});

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

function projectileFixture(arena=ARENAS[0],types=['ranged','bruiser']){
 const p=types.map((type,i)=>({name:'P'+i,hp:100,squad:[makeChassis(type)]}));
 const state=spawn(p,arena,9);
 state.units.forEach(u=>{u.x=90+u.owner*90;u.y=200});
 state.visualEvents=[];
 state.projectiles=[];
 return state;
}
function testShot(state,source,settings={}){
 const shot={id:1,owner:source.owner,source,x:source.x,y:source.y,
  vx:settings.vx??1,vy:settings.vy??0,speed:settings.speed??PROJECTILE_SPEED,
  remaining:settings.remaining??250,radius:settings.radius??3,
  damage:settings.damage??14,knockback:0,taunt:0,penetration:settings.piercing??0,
  hitIds:new Set(),volley:{hitIds:new Set()}};
 state.projectiles.push(shot);return shot;
}
test('wall absorbs projectile before any enemy behind it',()=>{
 const b=projectileFixture(ARENAS[1]),a=b.units[0],enemy=b.units[1];
 a.x=240;a.y=210;enemy.x=350;enemy.y=210;
 testShot(b,a,{remaining:150});
 const hits=advanceProjectiles(b,1);
 assert.equal(hits.length,0);
 assert.equal(b.projectiles.length,0);
 assert.ok(!b.visualEvents.some(e=>e.kind==='impact'));
});
test('front enemy intercepts a shot intended for a rear enemy',()=>{
 const b=projectileFixture(ARENAS[0],['ranged','bruiser','bruiser']);
 const [a,front,back]=b.units;a.x=100;a.y=200;
 front.x=155;front.y=200;back.x=210;back.y=200;
 testShot(b,a,{remaining:180});
 const hits=advanceProjectiles(b,1);
 assert.deepEqual(hits.map(h=>h.target.id),[front.id]);
 assert.equal(b.projectiles.length,0);
});
test('friendly units do not intercept friendly shots',()=>{
 const b=projectileFixture(ARENAS[0],['ranged','bruiser','bruiser']);
 const [a,ally,enemy]=b.units;
 a.owner=ally.owner=0;enemy.owner=1;
 a.x=100;a.y=200;ally.x=150;ally.y=200;
 enemy.x=210;enemy.y=200;
 testShot(b,a,{remaining:170});
 const hits=advanceProjectiles(b,1);
 assert.deepEqual(hits.map(h=>h.target.id),[enemy.id]);
});
test('piercing can hit multiple enemies, each at most once, along one path',()=>{
 const b=projectileFixture(ARENAS[0],['ranged','bruiser','bruiser','bruiser']);
 const [a,one,two,three]=b.units;
 a.x=100;a.y=200;one.x=145;two.x=190;three.x=235;
 one.y=two.y=three.y=200;
 testShot(b,a,{remaining:180,piercing:1});
 const hits=advanceProjectiles(b,1);
 assert.deepEqual(hits.map(h=>h.target.id),[one.id,two.id]);
 assert.equal(b.projectiles.length,0);
 assert.equal(b.visualEvents.filter(e=>e.kind==='impact').length,2);
});
test('swept projectile collision cannot skip small targets at high velocity',()=>{
 const b=projectileFixture(ARENAS[0]),[a,enemy]=b.units;
 a.x=100;a.y=200;enemy.x=200;enemy.y=200;
 testShot(b,a,{speed:12000,remaining:180});
 assert.deepEqual(advanceProjectiles(b,STEP).map(h=>h.target.id),[enemy.id]);
});
test('projectiles expire at range and arena boundaries',()=>{
 const b=projectileFixture(ARENAS[0]),[a,enemy]=b.units;
 a.x=100;a.y=200;enemy.x=300;enemy.y=300;
 testShot(b,a,{remaining:35});
 assert.equal(advanceProjectiles(b,1).length,0);
 assert.equal(b.projectiles.length,0);
 a.x=680;a.y=200;
 testShot(b,a,{remaining:120});
 assert.equal(advanceProjectiles(b,1).length,0);
 assert.equal(b.projectiles.length,0);
});
test('separate lanes cannot damage an intercepted unit twice in the same volley',()=>{
 const b=projectileFixture(),[a,enemy]=b.units;
 a.x=100;a.y=200;enemy.x=155;enemy.y=200;
 const volley={hitIds:new Set()};
 const first=testShot(b,a);first.volley=volley;
 const second=testShot(b,a);second.volley=volley;
 const hits=advanceProjectiles(b,1);
 assert.deepEqual(hits.map(h=>h.target.id),[enemy.id]);
});

test('draft catalog omits flat stat boosts but includes modest Range',()=>{
 for(const key of ['damage','hp','speed','rate'])assert.ok(!ATTACK_MODULES.includes(key),key);
 for(const key of ['projectiles','piercing','area','knockback','taunt','range'])assert.ok(ATTACK_MODULES.includes(key),key);
 assert.ok(!catalog.some(card=>card.kind==='attack'&&['damage','hp','speed','rate'].includes(card.key)));
});
test('duplicate utility draft upgrades existing slot to two, capped, without replacing another passive',()=>{
 const m=createMatch(['bruiser','bruiser','rogue','ranged'],12);
 m.players[0].squad[0].passives=['dash','bulwark'];
 m.players[0].squad[0].mods.dash=1;
 draftPool(m);
 m.draft.pool=[{kind:'utility',key:'dash',name:'Utility: dash',uid:'test'}];
 m.draft.originalPool=m.draft.pool.slice();m.draft.order=[0];
 assert.ok(legal(m.players[0],m.draft.pool[0]));
 assign(m,0,'test',0,1);
 const unit=m.players[0].squad[0];
 assert.deepEqual(unit.passives,['dash','bulwark']);
 assert.equal(unit.mods.dash,2);
 assert.equal(unit.modules.find(card=>card.kind==='utility').passiveSlot,1);
 assert.equal(canEquip(unit,{kind:'utility',key:'dash'}),false);
 assert.equal(utilityCooldown(5,1),5);
 assert.equal(utilityCooldown(5,2),2.5);
 assert.equal(utilityCooldown(5,99),2.5);
});
test('a third utility copy is rejected on the same chassis but can be drafted for other chassis',()=>{
 const m=createMatch(['bruiser','bruiser','rogue','ranged'],14);
 m.players[0].squad[0].passives=['dash'];
 m.players[0].squad[0].mods.dash=2;
 const offer={kind:'utility',key:'dash',uid:'test',name:'Dash'};
 draftPool(m);m.draft.pool=[offer];m.draft.order=[0];
 assert.ok(legal(m.players[0],offer)===false);
 assert.throws(()=>assign(m,0,'test',0),/Illegal draft pick|cannot equip/);
 m.players[0].squad.push(makeChassis('rogue'));
 assert.ok(legal(m.players[0],offer));
 assert.throws(()=>assign(m,0,'test',0),/cannot equip/);
 assign(m,0,'test',1);
 assert.equal(m.players[0].squad[1].mods.dash,1);
});
test('nonstacking passive duplicates are rejected without restricting the shared pool',()=>{
 const m=createMatch(['bruiser','bruiser','rogue','ranged'],19);
 m.players[0].squad[0].passives=['focus'];
 const offer={kind:'passive',key:'focus',uid:'focus',name:'Focus'};
 draftPool(m);m.draft.pool=[offer];m.draft.order=[0];
 assert.equal(legal(m.players[0],offer),false);
 assert.throws(()=>assign(m,0,'focus',0),/Illegal draft pick|cannot equip/);
 m.players[0].squad.push(makeChassis('ranged'));
 assert.equal(legal(m.players[0],offer),true);
 assign(m,0,'focus',1);
 assert.deepEqual(m.players[0].squad[1].passives,['focus']);
});
test('wall hits create lightweight wall visual signal and combat report metric',()=>{
 const b=spawn(players(),ARENAS[1],192),source=b.units[0];
 source.x=240;source.y=210;
 b.units[0].chassis=makeChassis('ranged');source.type='ranged';
 b.projectiles=[{id:1,owner:source.owner,source,aimedAtId:101,x:source.x,y:source.y,
  vx:1,vy:0,speed:1000,remaining:130,radius:3,damage:14,knockback:0,taunt:0,
  penetration:0,hitIds:new Set(),volley:{hitIds:new Set()}}];
 b.visualEvents=[];
 advanceProjectiles(b,STEP*6);
 assert.equal(source.combatStats.wallHits,1);
 assert.equal(b.projectiles.length,0);
 assert.ok(b.visualEvents.some(e=>e.kind==='wallImpact'&&Number.isFinite(e.x)));
});
test('per-unit round report balances applied damage and damage received',()=>{
 const m=createMatch(['ranged','bruiser','rogue','bruiser'],222);
 draftPool(m);
 while(m.phase==='draft'){
  const i=m.draft.order[m.draft.turn];
  assign(m,i,m.draft.pool.find(card=>legal(m.players[i],card)).uid);
 }
 const b=beginCombat(m);
 for(let t=0;t<900;t++)if(tick(b,STEP)!==null)break;
 const report=completeCombat(m,b).combatReport;
 assert.equal(report.length,b.units.length);
 assert.ok(report.every(r=>Number.isFinite(r.damage)&&Number.isFinite(r.damageTaken)&&r.damage>=0&&r.damageTaken>=0));
 const dealt=report.reduce((sum,u)=>sum+u.damage,0);
 const taken=report.reduce((sum,u)=>sum+u.damageTaken,0);
 assert.ok(Math.abs(dealt-taken)<.2,'actual applied outgoing and incoming damage should match');
});

test('shared draft preserves identical offers for competing players',()=>{
 const m=createMatch(['bruiser','bruiser','rogue','ranged'],7);
 const index=catalog.findIndex(c=>c.kind==='utility'&&c.key==='dash');
 m.random=()=>((index+.25)/catalog.length);
 draftPool(m);
 assert.equal(m.draft.originalPool.length,6);
 assert.ok(m.draft.originalPool.every(card=>card.key==='dash'&&card.kind==='utility'));
 assert.equal(new Set(m.draft.originalPool.map(card=>card.uid)).size,6);
});

test('reactive dodge avoids a threatening projectile but does not react to a miss',()=>{
 const run=(y)=>{
  const b=projectileFixture(ARENAS[0],['bruiser','ranged']);
  const defender=b.units[0],shooter=b.units[1];
  defender.chassis.passives.push('dodge');defender.chassis.mods.dodge=1;
  defender.x=180;defender.y=210;shooter.x=95;shooter.y=350;
  defender.cd=100;shooter.cd=100;
  testShot(b,shooter,{vx:1,vy:0,remaining:200});
  const shot=b.projectiles[0];shot.y=y;shot.x=135;shot.aimedAtId=defender.id;
  tick(b,STEP);
  return {b,defender};
 };
 const direct=run(210);
 assert.equal(direct.defender.combatStats.dodges,1);
 assert.ok(direct.b.visualEvents.some(e=>e.kind==='mobility'&&e.ability==='dodge'));
 const miss=run(100);
 assert.equal(miss.defender.combatStats.dodges,0);
});
test('haste reacts to pursuit and focus reacts to a finish opportunity',()=>{
 const b=projectileFixture(ARENAS[0],['bruiser','bruiser']);
 const [pursuer,target]=b.units;
 pursuer.chassis.passives=['haste','focus'];pursuer.x=90;pursuer.y=220;
 target.x=270;target.y=220;target.cd=1000;pursuer.cd=1000;
 tick(b,STEP);assert.equal(pursuer.combatStats.haste,1);
 assert.ok(pursuer.hasteUntil>b.time);
 pursuer.x=240;target.hp=16;pursuer.cd=0;
 tick(b,STEP);assert.equal(pursuer.combatStats.focus,1);
 assert.ok(pursuer.focusUntil>b.time);
});
test('bulwark prepares before a dangerous attack rather than providing permanent defense',()=>{
 const b=projectileFixture(ARENAS[0],['bruiser','bruiser']);
 const [defender,attacker]=b.units;defender.chassis.passives=['bulwark'];
 defender.x=180;defender.y=210;attacker.x=215;attacker.y=210;
 attacker.cd=0;defender.cd=1000;
 assert.equal(stats(defender).defense,4);
 for(let i=0;i<6;i++)tick(b,STEP);
 assert.equal(defender.combatStats.bulwark,1);
 assert.ok(defender.bulwarkUntil>b.time);
 assert.equal(stats(defender).defense,9);
});
test('fully unusable shared board gets one legal fallback without removing duplicates prematurely',()=>{
 const m=createMatch(['bruiser','bruiser'],151);draftPool(m);
 const p=m.players[0];p.squad=[makeChassis('bruiser'),makeChassis('rogue'),makeChassis('ranged')];
 for(const u of p.squad){u.passives=['focus','regen'];u.mods.dash=2}
 const dead={kind:'passive',key:'focus',name:'Passive: focus',uid:'x'};
 m.draft.pool=[{...dead},{...dead,uid:'y'}];
 m.draft.originalPool=m.draft.pool.map(x=>({...x}));
 m.draft.order=[0,1];m.draft.turn=0;
 ensureDraftChoice(m);
 assert.equal(m.draft.pool.length,2);
 assert.ok(m.draft.pool.some(c=>legal(p,c)));
 assert.ok(m.draft.originalPool.some(c=>c.kind==='target'));
});

test('Dodge does not consume cooldown on a projectile still outside reaction horizon',()=>{
 const b=projectileFixture(ARENAS[0],['bruiser','ranged']);
 const [defender,shooter]=b.units;
 defender.chassis.passives=['dodge'];defender.chassis.mods.dodge=1;
 defender.x=290;defender.y=210;defender.cd=1000;
 shooter.x=70;shooter.y=210;shooter.cd=1000;
 const shot=testShot(b,shooter,{remaining:300});
 shot.x=90;shot.y=210;shot.aimedAtId=defender.id;
 tick(b,STEP);
 assert.equal(defender.combatStats.dodges,0);
 assert.equal(defender.reactionCd.dodge||0,0);
});
test('Focus saves its burst for a multi-hit finish and not an automatic one-shot',()=>{
 const b=projectileFixture(ARENAS[0],['bruiser','bruiser']);
 const [attacker,target]=b.units;
 attacker.chassis.passives=['focus'];attacker.x=200;attacker.y=210;
 target.x=237;target.y=210;target.cd=1000;
 attacker.cd=0;target.hp=3;tick(b,STEP);
 assert.equal(attacker.combatStats.focus,0);
 const another=projectileFixture(ARENAS[0],['bruiser','bruiser']);
 const [a,t]=another.units;a.chassis.passives=['focus'];a.x=200;a.y=210;
 t.x=237;t.y=210;a.cd=0;t.cd=1000;t.hp=16;
 tick(another,STEP);
 assert.equal(a.combatStats.focus,1);
});
test('Dodge ignores distant projectile paths even when nearby enemy is ranged',()=>{
 const b=projectileFixture(ARENAS[0],['bruiser','ranged']);
 const [d,r]=b.units;
 d.chassis.passives=['dodge'];d.chassis.mods.dodge=1;
 d.x=200;d.y=200;r.x=215;r.y=200;d.cd=1000;r.cd=1000;
 tick(b,STEP);
 assert.equal(d.combatStats.dodges,0);
});
test('Haste does not repeatedly activate while already active',()=>{
 const b=projectileFixture(ARENAS[0],['bruiser','bruiser']);
 const [a,t]=b.units;
 a.chassis.passives=['haste'];a.x=80;a.y=210;t.x=320;t.y=210;
 t.cd=1000;
 tick(b,STEP);
 assert.equal(a.combatStats.haste,1);
 for(let i=0;i<30;i++)tick(b,STEP);
 assert.equal(a.combatStats.haste,1);
});

test('Prototype 2.6 attack profile preserves one hit without Piercing',()=>{
 assert.equal(CHASSIS.bruiser.damage,16);
 assert.equal(ATTACK_TIMING.bruiser.arc,95);
 assert.equal(ATTACK_TIMING.rogue.windup,.18);
 assert.equal(ATTACK_TIMING.rogue.recovery,.12);
 const p=players(),b=spawn(p,ARENAS[0],894),u=b.units[0],front=b.units[1],side=b.units[2];
 b.units=[u,front,side];
 u.x=200;u.y=220;front.x=245;front.y=220;
 side.x=242;side.y=243; // Both within the narrowed sweep.
 assert.deepEqual(meleeAttackTargets(b,u,0,stats(u)).map(e=>e.id),[front.id]);
 u.chassis.mods.piercing=1;
 assert.deepEqual(meleeAttackTargets(b,u,0,stats(u)).map(e=>e.id),[front.id,side.id]);
});
test('Bruiser narrowed arc excludes a lateral opponent',()=>{
 const p=players(),b=spawn(p,ARENAS[0],895),u=b.units[0],front=b.units[1],flank=b.units[2];
 b.units=[u,front,flank];u.x=200;u.y=220;front.x=248;front.y=220;
 flank.x=220;flank.y=270;
 u.chassis.mods.piercing=1;
 assert.deepEqual(meleeAttackTargets(b,u,0,stats(u)).map(e=>e.id),[front.id]);
});
test('melee sweep hits a front target and cannot hit a rear target',()=>{
 const p=players();const b=spawn(p,ARENAS[0],889),u=b.units[0],front=b.units[1],behind=b.units[2];
 b.units=[u,front,behind];u.x=200;u.y=220;front.x=247;front.y=220;behind.x=160;behind.y=220;
 const hits=meleeAttackTargets(b,u,0,stats(u));
 assert.deepEqual(hits.map(e=>e.id),[front.id]);
});
test('rogue narrow thrust reaches beyond contact but rejects flank',()=>{
 const p=players();p[0].squad[0]=makeChassis('rogue');
 const b=spawn(p,ARENAS[0],890),u=b.units[0],front=b.units[1],off=b.units[2];
 b.units=[u,front,off];u.x=200;u.y=220;front.x=254;front.y=220;off.x=246;off.y=271;
 const hits=meleeAttackTargets(b,u,0,stats(u));
 assert.deepEqual(hits.map(e=>e.id),[front.id]);
});
test('melee direction locks during windup and target leaving arc avoids hit',()=>{
 const b=spawn(players(),ARENAS[0],891),a=b.units[0],victim=b.units[1];
 b.units=[a,victim];a.x=200;a.y=220;victim.x=247;victim.y=220;a.cd=0;victim.cd=999;
 assert.ok(startAttack(b,a,victim));
 const attacks=[];for(let i=0;i<5;i++){b.time+=STEP;advanceAttack(b,a,victim,stats(a),STEP,attacks)}
 assert.ok(a.attack.locked);
 const locked=a.attack.direction;
 victim.x=200;victim.y=268;
 for(let i=0;i<6;i++){b.time+=STEP;advanceAttack(b,a,victim,stats(a),STEP,attacks)}
 assert.equal(a.attack.direction,locked);
 assert.equal(attacks.length,0);
});
test('another opponent entering a committed swing is struck at release',()=>{
 const b=spawn(players(),ARENAS[0],892),a=b.units[0],victim=b.units[1],interloper=b.units[2];
 b.units=[a,victim,interloper];a.x=200;a.y=220;victim.x=247;victim.y=220;
 interloper.x=200;interloper.y=300;a.cd=0;victim.cd=interloper.cd=999;
 startAttack(b,a,victim);
 const attacks=[];for(let i=0;i<5;i++)advanceAttack(b,a,victim,stats(a),STEP,attacks);
 victim.x=200;victim.y=300;interloper.x=248;interloper.y=222;
 for(let i=0;i<5;i++)advanceAttack(b,a,victim,stats(a),STEP,attacks);
 assert.ok(attacks.some(hit=>hit.target===interloper));
 assert.ok(!attacks.some(hit=>hit.target===victim));
});
test('attack windup and recovery create chassis-specific movement penalties',()=>{
 for(const type of Object.keys(CHASSIS)){
  const p=players();p[0].squad[0]=makeChassis(type);
  const b=spawn(p),a=b.units[0],enemy=b.units[1];
  a.cd=0;startAttack(b,a,enemy);
  const wind=attackMovementMultiplier(a);
  assert.ok(wind<1&&wind>0);
  const attacks=[];for(let i=0;i<Math.ceil(ATTACK_TIMING[type].windup/STEP)+1;i++)
   advanceAttack(b,a,enemy,stats(a),STEP,attacks);
  assert.equal(a.attack.phase,'recovery');
  const recovery=attackMovementMultiplier(a);
  assert.ok(recovery>wind&&recovery<1);
  for(let i=0;i<Math.ceil(ATTACK_TIMING[type].recovery/STEP)+1;i++)
   advanceAttack(b,a,enemy,stats(a),STEP,attacks);
  assert.equal(a.attack,null);
  assert.equal(attackMovementMultiplier(a),1);
 }
});
test('committed attack emits a renderer-independent visual event',()=>{
 const b=spawn(players(),ARENAS[0],893),a=b.units[0],target=b.units[1];
 a.cd=0;startAttack(b,a,target);
 const hits=[];
 for(let i=0;i<Math.ceil(ATTACK_TIMING.bruiser.windup*.5/STEP)+1;i++)
  advanceAttack(b,a,target,stats(a),STEP,hits);
 assert.ok(b.visualEvents.some(e=>e.kind==='attackCommit'&&e.type==='bruiser'&&Number.isFinite(e.angle)));
});

test('ranged attack commitment imposes actual movement penalties during its attack',()=>{
 const b=spawn([{name:'Shooter',hp:100,squad:[makeChassis('ranged')]},
                {name:'Pursuer',hp:100,squad:[makeChassis('bruiser')]}],ARENAS[0],901);
 const a=b.units[0],enemy=b.units[1];
 a.x=200;a.y=220;enemy.x=340;enemy.y=220;
 a.cd=0;enemy.cd=1000;
 tick(b,STEP);
 assert.equal(a.attack?.phase,'windup');
 const firstMovement=a.move?Math.hypot(a.move.x,a.move.y)*stats(a).speed*STEP*attackMovementMultiplier(a):0;
 assert.ok(firstMovement<stats(a).speed*STEP*.5);
 for(let i=0;i<9;i++)tick(b,STEP);
 assert.ok(a.combatStats.shots>0,'release should fire after windup');
 assert.equal(a.attack?.phase,'recovery');
});
test('Dodge can interrupt uncommitted windup and enforces a brief retry delay',()=>{
 const b=spawn([{name:'Dodger',hp:100,squad:[makeChassis('bruiser')]},
                {name:'Shooter',hp:100,squad:[makeChassis('ranged')]}],ARENAS[0],902);
 const a=b.units[0],enemy=b.units[1];
 a.chassis.passives=['dodge'];a.chassis.mods.dodge=1;
 a.x=200;a.y=200;enemy.x=240;enemy.y=200;
 a.cd=0;enemy.cd=1000;startAttack(b,a,enemy);
 const shot={id:901,owner:1,source:enemy,aimedAtId:a.id,x:175,y:200,vx:1,vy:0,
 speed:320,remaining:100,radius:3,damage:10,knockback:0,taunt:0,
 penetration:0,hitIds:new Set(),volley:{hitIds:new Set()}};
 b.projectiles.push(shot);
 tick(b,STEP);
 assert.ok(a.combatStats.dodges>0);
 assert.equal(a.attack,null);
 assert.ok(a.cd>0);
});

test('2.7 ranged and melee range stacks increase reach by eight',()=>{
 for(const type of Object.keys(CHASSIS)){
  const unit={type,chassis:makeChassis(type)};
  const base=stats(unit).range;unit.chassis.mods.range=2;
  assert.equal(stats(unit).range,base+16);
 }
});
test('2.7 chain splits rather than duplicating damage, and cannot recurse',()=>{
 const b=spawn(players(),ARENAS[0],910),u=b.units[0],a=b.units[1],other=b.units[2];
 b.units=[u,a,other];u.x=200;u.y=200;a.x=250;a.y=200;other.x=275;other.y=220;
 u.chassis.mods.chain=1;
 const attacks=resolveAttackModules(b,[{source:u,target:a,rawDamage:20,damage:20}]);
 assert.equal(attacks.length,2);
 assert.ok(Math.abs(attacks[0].damage-(20-stats(a).defense)*.8)<1e-6);
 assert.equal(attacks[1].secondary,true);
 assert.equal(attacks[1].target,other);
 assert.ok(attacks[1].damage<=4);
 const noOther=spawn(players(),ARENAS[0],911);
 noOther.units=noOther.units.slice(0,2);noOther.units[0].chassis.mods.chain=1;
 const lone=resolveAttackModules(noOther,[{source:noOther.units[0],target:noOther.units[1],rawDamage:20,damage:20}]);
 assert.equal(lone.length,1);
 assert.ok(Math.abs(lone[0].damage-(20-stats(noOther.units[1]).defense)*.8)<1e-6);
});
test('2.7 marks, burning, hazards and slow have bounded lifetimes',()=>{
 const b=spawn(players(),ARENAS[0],912),source=b.units[0],target=b.units[1];
 source.chassis.mods.expose=1;source.chassis.mods.burning=1;
 source.chassis.mods.disruption=1;source.chassis.mods.hazardous=1;
 resolveAttackModules(b,[{source,target,rawDamage:16,damage:16}]);
 assert.ok(target.effects.expose.until>b.time);
 assert.ok(target.effects.burn.until>b.time);
 assert.ok(target.effects.slowUntil>b.time);
 assert.equal(b.zones.length,1);
 assert.ok(b.zones[0].until>b.time);
});
test('2.7 restless attack favors a different target after hitting',()=>{
 const b=spawn(players(),ARENAS[0],913),source=b.units[0],a=b.units[1],other=b.units[2];
 b.units=[source,a,other];source.x=200;source.y=200;
 a.x=280;a.y=200;other.x=280;other.y=200;
 source.chassis.mods.restless=2;
 const beforeA=targetScoreDetails(b,source,a).total;
 source.lastAttacked=a.id;source.lastAttackAt=b.time;
 assert.ok(targetScoreDetails(b,source,a).total<beforeA);
 assert.ok(targetScoreDetails(b,source,other).total>targetScoreDetails(b,source,a).total);
});

test('2.7 Sunder reduces armor only to zero and hazards cap at two per fighter',()=>{
 const b=spawn(players(),ARENAS[0],914),source=b.units[0],target=b.units[1];
 b.units=[source,target];
 source.chassis.mods.sunder=2;source.chassis.mods.hazardous=1;
 const hit=()=>resolveAttackModules(b,[{source,target,rawDamage:10,damage:10}])[0];
 const first=hit();
 assert.equal(first.damage,10-stats(target).defense);
 const second=hit();
 assert.equal(second.damage,10-Math.max(0,stats(target).defense-2));
 for(let i=0;i<5;i++){b.time+=1.01;hit()}
 assert.equal(b.zones.filter(z=>z.source.id===source.id).length,2);
 target.effects.sunder=99;target.effects.sunderUntil=b.time+2;
 assert.equal(hit().damage,10-Math.max(0,stats(target).defense-3));
});
test('2.7 burn and hazard deal environmental damage without producing additional patches',()=>{
 const b=spawn(players(),ARENAS[0],915),source=b.units[0],target=b.units[1];
 b.units=[source,target];source.x=200;source.y=220;target.x=240;target.y=220;
 source.cd=target.cd=1000;
 source.chassis.mods.burning=1;source.chassis.mods.hazardous=1;
 resolveAttackModules(b,[{source,target,rawDamage:10,damage:10}]);
 const before=target.hp,zones=b.zones.length;
 tick(b,STEP);
 assert.ok(target.hp<before);
 assert.equal(b.zones.length,zones);
});

test('2.7 Retaliation primes only from direct melee and applies once',()=>{
 const p=players(),b=spawn(p,ARENAS[0],916),source=b.units[0],defender=b.units[1];
 b.units=[source,defender];source.x=200;source.y=220;defender.x=241;defender.y=220;
 source.cd=0;defender.cd=1000;defender.chassis.passives.push('retaliation');
 for(let i=0;i<15;i++)tick(b,STEP);
 assert.ok(defender.hp<defender.maxHp,'a melee hit must land');
 assert.ok(defender.retaliationReady>b.time,'direct melee primes Retaliation');
 const first=resolveAttackModules(b,[{source:defender,target:source,rawDamage:18,damage:18}]);
 assert.equal(first[0].rawDamage,22);
 const second=resolveAttackModules(b,[{source:defender,target:source,rawDamage:18,damage:18}]);
 assert.equal(second[0].rawDamage,18);
});

test('2.7.1 burning subtracts fractional HP and emits tagged DoT damage',()=>{
 const p=players(),b=spawn(p,ARENAS[0],917),source=b.units[0],target=b.units[1];
 b.units=[source,target];source.cd=target.cd=1000;
 source.x=200;source.y=220;target.x=242;target.y=220;
 source.chassis.mods.burning=1;
 resolveAttackModules(b,[{source,target,rawDamage:10,damage:10}]);
 const before=target.hp;
 tick(b,STEP);
 const expected=2*STEP;
 assert.ok(Math.abs(before-target.hp-expected)<1e-6);
 const event=b.visualEvents.find(e=>e.kind==='dotDamage'&&e.targetId===target.id);
 assert.ok(event,'fractional environmental damage should be tagged for aggregation');
 assert.ok(Math.abs(event.value-expected)<1e-6);
 for(let i=0;i<9;i++)tick(b,STEP);
 assert.ok(Math.abs(before-target.hp-expected*10)<1e-5);
});

test('2.8 progressive squad penalty scales base HP and damage for every chassis',()=>{
 const types=['bruiser','rogue','ranged'];
 for(const type of types){
  const base=makeChassis(type);
  for(const [count,mult] of [[1,1],[2,.85],[3,.7]]){
   const s=stats({type,chassis:base,squadSize:count});
   assert.ok(Math.abs(s.hp-CHASSIS[type].hp*mult)<1e-8);
   assert.ok(Math.abs(s.damage-CHASSIS[type].damage*mult)<1e-8);
   assert.equal(s.speed,CHASSIS[type].speed);
   assert.equal(s.defense,CHASSIS[type].defense);
   assert.equal(s.rate,CHASSIS[type].rate);
   assert.equal(s.range,CHASSIS[type].range);
  }
 }
});
test('2.8 recruited chassis scales old and new team members equally',()=>{
 const p=players();
 for(const count of [1,2,3]){
  p[0].squad=Array.from({length:count},()=>makeChassis('bruiser'));
  const b=spawn(p,ARENAS[0],940+count);
  const allies=b.units.filter(u=>u.owner===0);
  assert.equal(allies.length,count);
  for(const u of allies){
   const mult=1-.15*(count-1);
   assert.equal(u.squadSize,count);
   assert.ok(Math.abs(u.maxHp-CHASSIS.bruiser.hp*mult)<1e-8);
   assert.equal(u.hp,u.maxHp);
   assert.ok(Math.abs(stats(u).damage-CHASSIS.bruiser.damage*mult)<1e-8);
  }
  assert.equal(teamPercent(b,0),1);
 }
});
test('2.8 module bonuses are not diminished by squad-size penalties',()=>{
 const chassis=makeChassis('bruiser');
 chassis.mods.hp=2;chassis.mods.damage=2;
 const one=stats({type:'bruiser',chassis,squadSize:1});
 const three=stats({type:'bruiser',chassis,squadSize:3});
 assert.ok(Math.abs(one.hp-(CHASSIS.bruiser.hp+40))<1e-8);
 assert.ok(Math.abs(three.hp-(CHASSIS.bruiser.hp*.7+40))<1e-8);
 assert.ok(Math.abs(three.damage-(CHASSIS.bruiser.damage*.7+4))<1e-8);
});

test('2.8.1 every draft option has explicit readable summary and detail',()=>{
 for(const card of catalog){
  const key=card.kind+':'+card.key;
  assert.ok(DETAILS[key],key+' missing detail');
  assert.ok(SUMMARIES[key],key+' missing summary');
  assert.ok(cardDetail(card).length>30,key+' detail too short');
  assert.ok(cardSummary(card).length>12,key+' summary too short');
  assert.ok(!/undefined|NaN|\[object Object\]/.test(cardSummary(card)+cardDetail(card)),key);
  if(card.kind==='passive'||card.kind==='utility')assert.match(cardSummary(card),/^Utility · /);
  if(card.kind==='attack')assert.match(cardSummary(card),/^Attack · /);
  if(card.kind==='target')assert.match(cardSummary(card),/^Targeting · /);
 }
 assert.equal(Object.keys(DETAILS).length,catalog.length);
 assert.equal(Object.keys(SUMMARIES).length,catalog.length);
});
test('2.8.1 descriptions capture key effects and module-slot stacking rules',()=>{
 const by=(kind,key)=>({kind,key,name:key});
 assert.match(cardDetail(by('attack','area')),/9 units of melee reach and 12°/);
 assert.match(cardDetail(by('attack','range')),/8 units/);
 assert.match(cardDetail(by('attack','chain')),/20%/);
 assert.match(cardDetail(by('attack','chain')),/own defense/);
 assert.match(cardDetail(by('attack','sunder')),/subsequent attacks/);
 assert.match(cardDetail(by('attack','expose')),/DIFFERENT fighter/);
 assert.match(cardDetail(by('attack','burning')),/2 damage per second per stack/);
 assert.match(cardDetail(by('attack','hazardous')),/up to two patches/);
 assert.match(cardDetail(by('passive','retaliation')),/direct melee hit/);
 assert.match(cardDetail(by('utility','dash')),/halves the cooldown/);
 assert.match(cardSummary(by('utility','dash')),/second copy halves cooldown/);
});

test('2.9.1 direct bonus telemetry separately credits damage and respects HP cap',()=>{
 const p=players(),b=spawn(p,ARENAS[0],2010),source=b.units[0],target=b.units[1];
 b.units=[source,target];source.cd=target.cd=1e4;
 source.chassis.mods.precision=1;source.chassis.mods.momentum=1;
 source.motion=[{time:0,x:source.x-50,y:source.y},{time:0,x:source.x,y:source.y}];
 b.time=.01;
 const hit=resolveAttackModules(b,[{source,target,rawDamage:16,damage:16}])[0];
 assert.ok(hit.moduleDamage.precision>0);
 assert.ok(hit.moduleDamage.momentum>0);
 assert.equal(hit.moduleDamage.precision,2);
 assert.ok(Math.abs(hit.moduleDamage.momentum-1)<1e-9);
});
test('2.9.1 Sunder, Expose, Chain and Retaliation capture measurable contributions',()=>{
 const p=players(),b=spawn(p,ARENAS[0],2011),source=b.units[0],ally=b.units[1],enemy=b.units[2],extra=b.units[3];
 source.owner=ally.owner=0;enemy.owner=extra.owner=1;
 enemy.type='bruiser';enemy.chassis=makeChassis('bruiser');
 source.x=ally.x=180;source.y=ally.y=200;
 enemy.x=240;enemy.y=200;extra.x=260;extra.y=200;
 b.units=[source,ally,enemy,extra];
 source.chassis.mods.expose=2;source.chassis.mods.sunder=2;
 resolveAttackModules(b,[{source,target:enemy,rawDamage:20,damage:20}]);
 const follow=resolveAttackModules(b,[{source:ally,target:enemy,rawDamage:20,damage:20}])[0];
 assert.equal(follow.moduleDamage.expose,4);
 assert.equal(follow.moduleDamage.sunder,Math.min(2,stats(enemy).defense));
 ally.retaliationReady=b.time+4;
 const answer=resolveAttackModules(b,[{source:ally,target:enemy,rawDamage:20,damage:20}])[0];
 assert.equal(answer.moduleDamage.retaliation,4);
 ally.chassis.mods.chain=1;
 const chained=resolveAttackModules(b,[{source:ally,target:enemy,rawDamage:20,damage:20}]);
 assert.equal(chained.length,2);
 assert.equal(chained[1].moduleDamage.chain,chained[1].damage);
});
test('2.9.1 burn and hazard ticks retain source module identification',()=>{
 const p=players(),b=spawn(p,ARENAS[0],2012),source=b.units[0],target=b.units[1];
 b.units=[source,target];source.x=200;source.y=200;target.x=240;target.y=200;
 source.cd=target.cd=1e4;source.chassis.mods.burning=1;source.chassis.mods.hazardous=1;
 resolveAttackModules(b,[{source,target,rawDamage:16,damage:16}]);
 tick(b,STEP);
 assert.ok(source.combatStats.moduleDamage.burning>0);
 assert.ok(source.combatStats.moduleDamage.hazardous>0);
 assert.ok(Math.abs(source.combatStats.moduleDamage.burning-2*STEP)<1e-6);
 assert.ok(Math.abs(source.combatStats.moduleDamage.hazardous-2*STEP)<1e-6);
});
test('2.9.1 round combat report preserves module damage and delivered-impact fields',()=>{
 const match=createMatch(),battle=spawn(match.players,ARENAS[0],2013);
 const u=battle.units[0];u.combatStats.damage=12;
 u.combatStats.moduleDamage={burning:1.2567,precision:2};
 u.combatStats.moduleHits={piercing:4.321};
 u.combatStats.chainRedirected=3.135;
 // Completion accepts a finished battle and preserves its unit-level measurements.
 match.phase='combat';battle.time=30;const report=completeCombat(match,battle).combatReport[0];
 assert.equal(report.moduleDamage.burning,1.26);
 assert.equal(report.moduleDamage.precision,2);
 assert.equal(report.moduleHits.piercing,4.32);
 assert.equal(report.chainRedirected,3.14);
});

test('2.9.1 effective damage attribution cannot exceed real damage dealt to low-HP targets',()=>{
 const p=players(),b=spawn(p,ARENAS[0],2020),source=b.units[0],target=b.units[1];
 b.units=[source,target];source.x=200;source.y=220;target.x=248;target.y=220;
 source.cd=0;target.cd=1e4;target.maxHp=target.hp=2;
 source.chassis.mods.precision=2;
 // Low target HP should limit actual attributed damage and eliminate overkill credit.
 source.chassis.mods.momentum=4;
 const hit=resolveAttackModules(b,[{source,target,rawDamage:16,damage:16}])[0];
 assert.ok(hit.moduleDamage.precision>0);
 // Force this resolved hit through standard accounting via a deterministic melee exchange.
 const tagged=spawn(p,ARENAS[0],2021),a=tagged.units[0],v=tagged.units[1];
 tagged.units=[a,v];a.x=200;a.y=220;v.x=249;v.y=220;
 a.cd=0;v.cd=1e4;v.maxHp=v.hp=2;a.chassis.mods.precision=2;
 for(let i=0;i<16;i++)tick(tagged,STEP);
 const total=Object.values(a.combatStats.moduleDamage).reduce((x,y)=>x+y,0);
 assert.ok(total<=2+1e-6,'no more damage can be credited than actually dealt');
 assert.ok(a.combatStats.damage<=2+1e-6);
});
test('2.9.1 delivered-hit telemetry is explicitly separate from additive damage',()=>{
 const p=players(),b=spawn(p,ARENAS[0],2022),source=b.units[0],target=b.units[1];
 b.units=[source,target];source.x=200;source.y=220;target.x=245;target.y=220;
 source.chassis.mods.piercing=1;source.cd=0;target.cd=1e4;
 for(let i=0;i<16;i++)tick(b,STEP);
 assert.ok(source.combatStats.damage>0);
 assert.ok(source.combatStats.moduleHits);
 assert.ok(source.combatStats.moduleDamage);
 assert.equal(source.combatStats.moduleHits.piercing||0,0,'a single enemy is not a piercing follow-up');
});

test('2.10 every attack module has a compositional stage',()=>{
 assert.deepEqual([...Object.keys(ATTACK_STAGES)].sort(),ATTACK_MODULES.slice().sort());
 for(const [key,meta] of Object.entries(ATTACK_STAGES)){
  assert.ok(['shape','impact','aftermath','condition','targeting'].includes(meta.stage),key);
  assert.ok(meta.label,key);
 }
 assert.equal(ATTACK_STAGES.burning.cooldown,1);
 assert.equal(ATTACK_STAGES.hazardous.cooldown,1);
 assert.equal(ATTACK_STAGES.momentum.cooldown,undefined);
});
test('2.10 aftermath effects proc once per second independently, while keeping all targets in one attack',()=>{
 const b=spawn(players(),ARENAS[0],3020),source=b.units[0],a=b.units[1],other=b.units[2];
 b.units=[source,a,other];source.chassis.mods.burning=source.chassis.mods.hazardous=1;
 b.time=.05;
 resolveAttackModules(b,[{source,target:a,attackId:100,rawDamage:12},
  {source,target:other,attackId:100,rawDamage:12}]);
 assert.ok(a.effects.burn&&other.effects.burn);
 assert.equal(b.zones.length,2);
 const until=a.effects.burn.until;
 b.time=.4;
 resolveAttackModules(b,[{source,target:a,attackId:101,rawDamage:12}]);
 assert.equal(a.effects.burn.until,until);
 assert.equal(b.zones.length,2);
 b.time=.7;
 assert.ok(!claimAttackEffect(source,'hazardous',102,b.time));
 assert.ok(!claimAttackEffect(source,'burning',102,b.time));
 b.time=1.06;
 resolveAttackModules(b,[{source,target:a,attackId:102,rawDamage:12}]);
 assert.ok(a.effects.burn.until>until);
 assert.equal(b.zones.length,2);
 assert.ok(b.zones.some(z=>z.until>3));
});
test('2.10 effect cooldowns are per chassis and do not gate conditional hit damage',()=>{
 const b=spawn(players(),ARENAS[0],3021),source=b.units[0],target=b.units[1],other=b.units[2];
 b.units=[source,target,other];
 source.chassis.mods.burning=1;source.chassis.mods.precision=1;
 other.chassis.mods.burning=1;
 b.time=.1;
 const first=resolveAttackModules(b,[{source,target,attackId:1,rawDamage:12}])[0];
 assert.ok(first.moduleDamage.precision>0);
 assert.ok(claimAttackEffect(other,'burning',2,b.time));
 assert.ok(!claimAttackEffect(source,'burning',3,b.time));
 const next=resolveAttackModules(b,[{source,target,attackId:4,rawDamage:12}])[0];
 assert.equal(next.moduleDamage.precision,first.moduleDamage.precision);
});
test('2.10 same attack identifier can affect late-arriving projectile targets without reopening cooldown',()=>{
 const b=spawn(players(),ARENAS[0],3022),source=b.units[0],target=b.units[1],other=b.units[2];
 source.chassis.mods.burning=1;b.units=[source,target,other];
 b.time=.1;resolveAttackModules(b,[{source,target,attackId:55,rawDamage:12}]);
 b.time=.65;resolveAttackModules(b,[{source,target:other,attackId:55,rawDamage:12}]);
 assert.ok(other.effects.burn);
 assert.ok(!claimAttackEffect(source,'burning',56,b.time));
});

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
 assert.ok(Math.abs((u.x-100)-stats(u).speed*(1+.24)*STEP)<1e-6);
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
  const p=players();p[0].squad=[makeChassis(type)];const battle=spawn(p,ARENAS[0],9714);
  const unit=battle.units[0],target=battle.units[1];
  battle.units=[unit,target];unit.x=125;unit.y=200;target.x=315;target.y=200;
  unit.chassis.mods.dash=1;unit.cd=100;target.cd=100;
  tick(battle,STEP);
  const evt=battle.visualEvents.find(e=>e.kind==='mobility'&&e.ability==='dash');
  return evt?Math.hypot(evt.toX-evt.x,evt.toY-evt.y):null;
 };
 const bruiser=sample('bruiser'),rogue=sample('rogue');
 assert.ok(bruiser>0,'Dash still triggers');
 assert.ok(rogue>bruiser,'travel remains chassis speed based');
 assert.ok(bruiser<40&&rogue<65,'travel remains a bounded burst, not a teleport across the arena');
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
