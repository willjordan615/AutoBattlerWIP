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

const load=async(path,imports)=>{let code=execFileSync('git',['show',ref+':'+path],{encoding:'utf8'});for(const [from,to] of imports)code=code.replaceAll(from,to);const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64');return {url,api:await import(url)};};
const simUrl='data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const oldHead=await load('src/headless.js',[['./simulation.js?v=balance-312',simUrl]]);
const oldDraft=await load('src/draft-ai.js',[['./simulation.js?v=balance-312',simUrl],['./headless.js?v=balance-312',oldHead.url]]);
const newHead=await import('../src/headless.js');
const newDraft=await import('../src/draft-ai.js');
for(const policy of ['random','strategic'])for(const seed of [1,2,3,4]){
 const a=oldHead.api.createMatch(undefined,seed),b=newHead.createMatch(undefined,seed);
 oldHead.api.draftPool(a);newHead.draftPool(b);
 const check=(label,x,y)=>assert.equal(snapshot(x),snapshot(y),policy+' seed '+seed+' round '+a.round+' '+label);
 const draft=(h,d,m)=>{if(policy==='random')return h.autoDraft(m);while(m.phase==='draft'){const i=m.draft.order[m.draft.turn],p=d.chooseCpuDraft(m,i);h.assign(m,i,p.card.uid,p.chassisIndex,p.passiveSlot,p);}};
 for(let round=0;round<250&&a.phase!=='finished';round++){
  check('initial draft',a,b);draft(oldHead.api,oldDraft.api,a);draft(newHead,newDraft,b);check('draft decisions',a,b);
  const x=oldHead.api.beginCombat(a),y=newHead.beginCombat(b);check('spawn',x,y);
  let ar=null,br=null;for(let t=0;t<900;t++){ar=baseline.tick(x,baseline.STEP);br=current.tick(y,current.STEP);if(t%30===0||ar!==null||br!==null){check('tick '+(t+1),x,y);check('tick result',ar,br);}if(ar!==null||br!==null)break;}
  check('end state',x,y);assert.notEqual(ar,null);check('round result',oldHead.api.completeCombat(a,x),newHead.completeCombat(b,y));check('match state',a,b);
 }
 assert.equal(a.phase,'finished');assert.equal(b.phase,'finished');console.log('Full-match parity '+policy+' seed '+seed+': '+a.history.length+' rounds');
}
