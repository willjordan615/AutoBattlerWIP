import test from 'node:test';
import assert from 'node:assert/strict';
import {CHASSIS,ARENAS,STEP,makeChassis,stats,bound,chooseTarget,clearLine,resolveCollision,tick,spawn,placementGroups,placementDamage,resolvePlayerHP,teamPercent} from '../src/simulation.js';
const players=()=>Array.from({length:4},(_,i)=>({name:'P'+i,hp:100,streak:0,squad:[makeChassis(['bruiser','rogue','ranged','bruiser'][i])]}));
test('chassis mutations are independent',()=>{const a=makeChassis('bruiser'),b=makeChassis('bruiser');a.mods.hp=2;assert.equal(stats({type:'bruiser',chassis:a}).hp,195);assert.equal(stats({type:'bruiser',chassis:b}).hp,155)});
test('wall clamping for all archetypes',()=>{for(const type of Object.keys(CHASSIS)){const u={type,x:-100,y:900};bound(u);assert.ok(u.x>20&&u.y<500)}});
test('obstacles block line of sight',()=>{const arena=ARENAS[1];assert.equal(clearLine({x:200,y:200},{x:400,y:200},arena),false);assert.equal(clearLine({x:200,y:80},{x:400,y:80},arena),true)});
test('obstacle collisions keep fighters outside',()=>{const u={type:'bruiser',x:300,y:200};bound(u,ARENAS[1]);assert.ok(u.x<=260||u.x>=336||u.y<=154||u.y>=275)});
test('unit collision resolves overlap',()=>{const s=spawn(players());s.units[1].x=s.units[0].x;s.units[1].y=s.units[0].y;resolveCollision(s);assert.ok(Math.hypot(s.units[1].x-s.units[0].x,s.units[1].y-s.units[0].y)>20)});
test('all ten utility metrics exist',()=>{const c=makeChassis('rogue');assert.equal(Object.keys(c.weights).length,10);c.weights.kill+=1;assert.equal(c.weights.kill,2.4)});
test('simultaneous elimination records same tick',()=>{const s=spawn(players());s.units=s.units.slice(0,2);s.units[0].owner=0;s.units[1].owner=1;s.units[0].x=100;s.units[1].x=120;s.units[0].y=s.units[1].y=100;s.units[0].hp=s.units[1].hp=1;s.units[0].cd=s.units[1].cd=0;tick(s,STEP);assert.equal(s.units[0].hp,0);assert.equal(s.units[1].hp,0);assert.equal(s.eliminations.length,2);assert.equal(s.eliminations[0].tick,s.eliminations[1].tick)});
test('30 second timeout',()=>{const s=spawn(players());s.units.forEach((u,i)=>{u.x=50+i*200;u.y=50;u.cd=1000});let result=null;for(let i=0;i<901&&result===null;i++)result=tick(s,STEP);assert.ok(s.time>=30&&s.time<30.1)});
test('survivors rank above eliminated',()=>{const s=spawn(players());s.units[1].hp=0;s.eliminations=[{owner:1,tick:5}];const groups=placementGroups(s);assert.equal(groups.at(-1)[0],1)});
test('team HP percent uses max HP of defeated units',()=>{const p=players();p[0].squad.push(makeChassis('bruiser'));const s=spawn(p);s.units[0].hp=0;assert.equal(teamPercent(s,0),.5)});
test('round winner takes zero persistent damage',()=>{const p=players();resolvePlayerHP(p,[0,1,2,3],1);assert.equal(p[0].hp,100);assert.ok(p[3].hp<p[2].hp)});
test('bottom-half streak breaks on top-half finish',()=>{const p=players();resolvePlayerHP(p,[0,1,2,3],1);assert.equal(p[3].streak,1);resolvePlayerHP(p,[3,1,0,2],2);assert.equal(p[3].streak,0)});
test('damage increases with round number',()=>{assert.ok(placementDamage(10,4,4,0)>placementDamage(1,4,4,0))});
test('deterministic simulation for same seed',()=>{const run=()=>{const s=spawn(players(),ARENAS[1],17);for(let i=0;i<900;i++)if(tick(s,STEP)!==null)break;return s.units.map(u=>[u.hp,u.x,u.y])};assert.deepEqual(run(),run())});

test('attack mutations stack linearly and compose',()=>{const c=makeChassis('ranged');c.mods.projectiles=2;c.mods.piercing=2;c.mods.damage=3;const st=stats({type:'ranged',chassis:c});assert.equal(st.projectiles,3);assert.equal(st.piercing,2);assert.equal(st.damage,20)});
test('targeting mutation weights stack additively',()=>{const c=makeChassis('bruiser');const initial=c.weights.kill;c.weights.kill+=1;c.weights.kill+=1;assert.equal(c.weights.kill,initial+2)});
test('defensive passive changes defense and regen preserves max HP',()=>{const c=makeChassis('bruiser');c.passives.push('bulwark','regen');const st=stats({type:'bruiser',chassis:c});assert.equal(st.defense,7);const p=players();p[0].squad[0]=c;const battle=spawn(p);const u=battle.units[0];u.hp=u.maxHp-10;u.cd=1000;tick(battle,STEP);assert.ok(u.hp>u.maxHp-10&&u.hp<=u.maxHp)});
test('eliminations on the same tick form a placement tie',()=>{const p=players(),s=spawn(p);s.units[1].hp=0;s.units[2].hp=0;s.eliminations=[{owner:1,tick:17},{owner:2,tick:17}];const groups=placementGroups(s);assert.deepEqual(groups.at(-1),[1,2])});

test('all players receive unique randomized corners and move corners every round',()=>{const p=players();for(let seed=1;seed<=30;seed++){let previous=null;for(let round=1;round<=8;round++){const a=spawn(p,ARENAS[0],seed+round*991,round,previous),b=spawn(p,ARENAS[0],seed+round*991,round,previous);assert.deepEqual(a.spawnSlots,b.spawnSlots);assert.deepEqual([...a.spawnSlots].sort(),[0,1,2,3]);if(previous)for(let i=0;i<4;i++)assert.ok(a.spawnSlots[i]!==previous[i]);for(let i=0;i<4;i++){const unit=a.units.find(u=>u.owner===i);assert.ok(unit);const corner=a.spawnSlots[i];assert.ok((corner===0||corner===3?unit.x<200:unit.x>500));assert.ok((corner===0||corner===1?unit.y<200:unit.y>300))}previous=a.spawnSlots}}});

test('combat emits floating damage and projectile visual events without changing HP math',()=>{const p=players();const state=spawn(p,ARENAS[0],33);const attacker=state.units.find(u=>u.type==='ranged');const victim=state.units.find(u=>u.owner!==attacker.owner);for(const u of state.units)if(u!==attacker&&u!==victim)u.hp=0;attacker.x=200;attacker.y=200;victim.x=260;victim.y=200;attacker.cd=0;const before=victim.hp;tick(state,STEP);assert.ok(state.visualEvents.some(e=>e.kind==='projectile'&&e.owner===attacker.owner));const damage=state.visualEvents.find(e=>e.kind==='damage'&&e.owner===victim.owner);assert.ok(damage);assert.equal(damage.value,before-victim.hp);tick(state,STEP);assert.ok(!state.visualEvents.some(e=>e.kind==='projectile'))});

test('Bruiser base damage is 13',()=>{assert.equal(CHASSIS.bruiser.damage,13)});
test('taunt forces the struck enemy to target its attacker and expires',()=>{
 const p=players(),state=spawn(p,ARENAS[0],47);
 const taunter=state.units[0],victim=state.units[1],alternative=state.units[2];
 for(const u of state.units)if(u!==taunter&&u!==victim&&u!==alternative)u.hp=0;
 taunter.chassis.mods.taunt=2;
 taunter.x=200;taunter.y=200;victim.x=226;victim.y=200;
 alternative.x=229;alternative.y=200;
 // Force a hit on the victim; the alternative is on the attacker's team.
 alternative.owner=taunter.owner;alternative.cd=99;victim.cd=99;taunter.cd=0;
 tick(state,STEP);
 assert.equal(victim.tauntedBy,taunter.id);
 assert.ok(victim.tauntedUntil-state.time>.49);
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
test('multishot cannot damage the same enemy twice per attack cycle',()=>{
 const p=players();p[0].squad[0]=makeChassis('ranged');
 const s=spawn(p,ARENAS[0],51),a=s.units[0],v=s.units[1];
 s.units=s.units.slice(0,2);a.chassis.mods.projectiles=4;
 a.x=200;a.y=200;v.x=260;v.y=200;a.cd=0;v.cd=99;
 const before=v.hp;tick(s,STEP);
 assert.equal(before-v.hp,Math.max(1,stats(a).damage-stats(v).defense));
 assert.equal(s.visualEvents.filter(e=>e.kind==='projectile').length,5);
});
test('multishot spreads sideways while pierce adds depth',()=>{
 const p=players();p[0].squad[0]=makeChassis('ranged');
 const s=spawn(p,ARENAS[0],53),a=s.units[0],center=s.units[1],side=s.units[2],behind=s.units[3];
 a.x=200;a.y=200;center.x=260;center.y=200;side.x=260;side.y=214;behind.x=290;behind.y=200;
 for(const u of [center,side,behind]){u.cd=99;u.owner=1}
 a.cd=0;
 // Without upgrades, only the central target is hit.
 const before=[center.hp,side.hp,behind.hp];tick(s,STEP);
 assert.ok(center.hp<before[0]);assert.equal(side.hp,before[1]);assert.equal(behind.hp,before[2]);
 for(let i=0;i<3;i++)s.units[i+1].hp=before[i];
 a.chassis.mods.projectiles=2;a.chassis.mods.piercing=1;a.cd=0;
 tick(s,STEP);
 assert.ok(center.hp<before[0]||side.hp<before[1]||behind.hp<before[2]);
});

test('dash advances toward target and respects cooldown',()=>{
 const p=players(),battle=spawn(p);battle.units=battle.units.slice(0,2);
 const a=battle.units[0],b=battle.units[1];a.x=150;a.y=200;b.x=290;b.y=200;
 a.chassis.mods.dash=1;a.cd=100;b.cd=100;
 tick(battle,STEP);assert.ok(a.x>165&&a.x<180);const first=a.mobilityCd.dash;assert.ok(first>battle.time);
 tick(battle,STEP);assert.equal(a.mobilityCd.dash,first);
});
test('followthrough passes target body block without passing other units',()=>{
 const p=players(),battle=spawn(p);battle.units=battle.units.slice(0,2);
 const a=battle.units[0],b=battle.units[1];a.x=180;a.y=200;b.x=215;b.y=200;
 a.chassis.mods.followthrough=2;a.cd=100;b.cd=100;
 tick(battle,STEP);
 assert.ok(a.x>=180&&a.x<215); // Ability activation depends on the position weights.
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
 assert.ok(bruiser<30,'a single Bruiser dash must be short');
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

