import test from 'node:test';
import assert from 'node:assert/strict';
import {makeChassis,spawn,stats,STEP,tick,ARENAS} from '../src/simulation.js';
import {coordinationStacks,syncLivingAllies} from '../src/engine/stats.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function fixture(n=2){
 const holder=makeChassis('bruiser');holder.mods.coordinated=1;holder.passives.push('coordinated');
 const players=[{hp:100,name:'A',squad:[holder,...Array.from({length:n-1},()=>makeChassis('rogue'))]},{hp:100,name:'B',squad:[makeChassis('ranged')]}];
 return spawn(players,ARENAS[0],61);
}
test('Coordinated is inactive with no other living ally; all five modifiers activate with allies',()=>{
 const solo=fixture(1).units[0],team=fixture(2).units[0];
 assert.equal(coordinationStacks(solo),0);assert.equal(coordinationStacks(team),1);
 const boosted=stats(team),plain=stats({...team,livingAllies:0});
 for(const k of ['hp','damage','speed','range'])close(boosted[k],plain[k]*1.1);
 close(boosted.rate,plain.rate/1.1);close(boosted.defense,plain.defense);close(boosted.radius,plain.radius);
 close(solo.maxHp,stats({...solo,livingAllies:0}).hp);
});
test('Coordinated expires only on losing last ally, preserving health percentage and fixed roster penalty',()=>{
 const b=fixture(3),[u,a,c]=b.units;
 u.hp=u.maxHp*.37;const max=u.maxHp;a.hp=0;syncLivingAllies(b);close(u.maxHp,max);close(u.hp,max*.37);
 c.hp=0;syncLivingAllies(b);assert.equal(coordinationStacks(u),0);close(u.maxHp,max/1.1);close(u.hp/u.maxHp,.37);
 assert.equal(u.squadSize,3);const hp=u.hp;syncLivingAllies(b);close(u.hp,hp);
});
test('tick updates last-ally state before decisions',()=>{
 const b=fixture(2),[u,a]=b.units;const max=u.maxHp;a.hp=0;u.cd=100;b.units.at(-1).cd=100;
 tick(b,STEP);assert.equal(u.livingAllies,0);close(u.maxHp,max/1.1);
});
test('same-tick ally defeat removes Coordinated immediately after damage',()=>{
 const b=fixture(2),[u,a,e]=b.units;u.cd=a.cd=e.cd=100;a.hp=.01;
 b.zones.push({x:a.x,y:a.y,radius:25,owner:e.owner,dps:100,until:5,source:e});
 const max=u.maxHp;tick(b,STEP);assert.equal(a.hp,0);assert.equal(u.livingAllies,0);close(u.maxHp,max/1.1);
});
