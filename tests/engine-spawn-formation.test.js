import test from 'node:test';
import assert from 'node:assert/strict';
import {ARENAS,makeChassis,spawn,bound,radiusOf} from '../src/simulation.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function fixture(mask,sizes){
 return Array.from({length:4},(_,i)=>({name:'P'+i,hp:mask&(1<<i)?100:0,squad:Array.from({length:sizes[i]},(_,j)=>{const c=makeChassis(['bruiser','rogue','ranged'][(i+j)%3]);c.mods.growth=1;return c;})}));
}
function verify(state,players){
 const active=players.flatMap((p,i)=>p.hp>0?[i]:[]),n=active.length;
 assert.equal(state.spawnSlots.filter(s=>s!==null).length,n);
 assert.equal(new Set(state.spawnSlots.filter(s=>s!==null)).size,n);
 const centers=active.map(owner=>{
  const units=state.units.filter(u=>u.owner===owner);assert.equal(units.length,players[owner].squad.length);
  return {x:units.reduce((s,u)=>s+u.x,0)/units.length,y:units.reduce((s,u)=>s+u.y,0)/units.length};
 });
 for(let i=0;i<4;i++)if(!active.includes(i)){assert.equal(state.spawnSlots[i],null);assert.ok(!state.units.some(u=>u.owner===i));}
 close(centers.reduce((s,p)=>s+p.x,0)/n,360);close(centers.reduce((s,p)=>s+p.y,0)/n,260);
 const distances=centers.flatMap((a,i)=>centers.slice(i+1).map(b=>distance(a,b))).sort((a,b)=>a-b);
 if(n===3){close(distances[0],distances[1]);close(distances[1],distances[2]);}
 if(n===2)assert.ok(distances[0]>250);
 if(n===4){for(let i=1;i<4;i++)close(distances[0],distances[i]);close(distances[4],distances[0]*Math.SQRT2);close(distances[5],distances[4]);}
 for(const [i,a] of state.units.entries()){
  const p={x:a.x,y:a.y,type:a.type,chassis:a.chassis};bound(p,state.arena);close(p.x,a.x);close(p.y,a.y);
  for(const b of state.units.slice(i+1))assert.ok(distance(a,b)>=radiusOf(a)+radiusOf(b));
 }
}
test('every active-team subset gets symmetric clear spawns across all arenas and squad sizes',()=>{
 for(const arena of ARENAS)for(let mask=1;mask<16;mask++)for(let seed=1;seed<=20;seed++){
  const players=fixture(mask,Array.from({length:4},(_,i)=>1+(i+seed)%3)),state=spawn(players,arena,seed,7);
  verify(state,players);const next=spawn(players,arena,seed,7);
  assert.deepEqual(next.spawnSlots,state.spawnSlots);assert.deepEqual(next.units.map(u=>[u.x,u.y,u.cd]),state.units.map(u=>[u.x,u.y,u.cd]));
 }
});
test('elimination changes a four-team square into a triangle, then opposite positions',()=>{
 const players=fixture(15,[1,2,3,2]),a=spawn(players,ARENAS[1],10,1);
 players[1].hp=0;const b=spawn(players,ARENAS[1],11,2,a.spawnSlots);verify(b,players);
 players[3].hp=0;const c=spawn(players,ARENAS[2],12,3,b.spawnSlots);verify(c,players);
 const d=spawn(players,ARENAS[2],13,4,c.spawnSlots);verify(d,players);
 assert.notEqual(d.spawnSlots[0],c.spawnSlots[0]);assert.notEqual(d.spawnSlots[2],c.spawnSlots[2]);
});
