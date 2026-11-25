import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as current from '../src/simulation.js';
const ref=process.argv[2];if(!ref)throw Error('Usage: npm run verify:parity -- <baseline SHA>');
if(!/^[a-f0-9]{7,40}$/i.test(ref))throw Error('Use a Git commit SHA');
const source=execFileSync('git',['show',ref+':src/simulation.js'],{encoding:'utf8'});
const baseline=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const snapshot=x=>JSON.stringify(x,(k,v)=>v instanceof Set?{set:[...v]}:v instanceof Map?{map:[...v]}:v);
assert.deepEqual(Object.keys(current).sort(),Object.keys(baseline).sort());
for(const seed of [2,3,4,5]){
 const make=api=>{const players=['bruiser','rogue','ranged','bruiser'].map((type,i)=>({name:'P'+i,hp:100,streak:0,squad:[api.makeChassis(type),...(seed%2?[api.makeChassis(['ranged','bruiser','rogue'][i%3])]:[])]}));for(const [i,p] of players.entries())for(const u of p.squad){Object.assign(u.mods,{ricochet:i%2,range:1,followthrough:i%2,projectiles:1,chain:1,dash:1,resolve:i%2});u.passives.push('regen','inspiration');}const b=api.spawn(players,api.ARENAS[seed%3],seed,1);b.moduleTelemetry={};return b;};
 const a=make(baseline),b=make(current);let x=null,y=null;for(let t=0;t<900;t++){x=baseline.tick(a);y=current.tick(b);if(t%30===0||x!==null||y!==null){assert.equal(snapshot(a),snapshot(b),'state mismatch seed '+seed+' tick '+(t+1));assert.deepEqual(x,y);}if(x!==null||y!==null)break;}assert.equal(snapshot(a),snapshot(b));assert.notEqual(y,null,'round did not finish');console.log('Parity seed '+seed+': '+b.tick+' ticks, '+b.units.length+' actors');
}
