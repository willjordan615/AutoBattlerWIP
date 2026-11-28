import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openHistory} from '../server/history.js';
import {attachRandom,makeCheckpoint,parseCheckpoint} from '../src/solo-storage.js';
import {createMatch,draftPool,autoDraft,fight} from '../src/headless.js';
test('history is private, opt-in, durable, deduplicated and deletable',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ab-history-')),path=join(dir,'test.sqlite');
 let now=1000,h=openHistory(path,{now:()=>now});
 const match={phase:'finished',players:[{name:'You',hp:4},{hp:0},{hp:0},{hp:0}],history:[{round:1,ranking:[0,1,2,3],remaining:[4,0,0,0],combatReport:[{id:0,owner:0,type:'rogue',damage:23,prevented:2}]}]};
 try{
  assert.equal(h.record('a','m',match,0,now),false);h.set('a',true);assert.equal(h.record('a','m',match,0,999),false);
  assert.equal(h.record('a','m',match,0,now),true);assert.equal(h.record('a','m',match,0,now),false);assert.equal(h.read('a').totals.wins,1);assert.equal(h.read('b').history.length,0);
  h.close();h=openHistory(path,{now:()=>now});assert.equal(h.read('a').history[0].damage,23);
  h.set('a',false);assert.equal(h.read('a').enabled,false);assert.equal(h.read('a').totals.matches,0);assert.equal(h.record('a','m2',match,0,now),false);
 }finally{h.close();rmSync(dir,{recursive:true,force:true});}
});
test('checkpoint restores deterministic RNG and next combat result',()=>{
 const types=['rogue','ranged','bruiser','rogue'],a=attachRandom(createMatch(types,9876));draftPool(a);autoDraft(a);
 const restored=parseCheckpoint(makeCheckpoint(a,types,[]));assert.ok(restored);const b=restored.match;
 assert.deepEqual(fight(a),fight(b));assert.deepEqual(a.draft,b.draft);assert.equal(a.randomCalls,b.randomCalls);assert.equal(a.random(),b.random());
 assert.equal(parseCheckpoint('bad'),null);assert.equal(parseCheckpoint(makeCheckpoint(a,types,[]).replace('engine-360-r4','obsolete')),null);
});

test('history HTTP API authenticates the guest, refuses cross-origin and extra fields, and cannot accept scores',async()=>{
 const {createApp}=await import('../server/index.js'),server=createApp();
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const post=(path,data,cookie,extra={})=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},body:JSON.stringify(data)});
 try{
  assert.equal((await fetch(url+'/api/history')).status,401);
  const issue=async()=>{const r=await post('/api/guest',{});return r.headers.get('set-cookie').split(';')[0];};
  const a=await issue(),b=await issue();
  assert.equal((await post('/api/history',{enabled:true},a,{'Origin':'https://other.example'})).status,403);
  assert.equal((await post('/api/history',{enabled:true,score:99},a)).status,400);
  assert.equal((await post('/api/history',{enabled:true},a)).status,200);
  assert.equal((await (await fetch(url+'/api/history',{headers:{Cookie:b}})).json()).enabled,false);
  assert.equal((await (await fetch(url+'/api/history',{headers:{Cookie:a}})).json()).enabled,true);
  assert.equal((await post('/api/history',{enabled:false},a)).status,200);
  assert.equal((await (await fetch(url+'/api/history',{headers:{Cookie:a}})).json()).enabled,false);
  const page=await fetch(url);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.equal((await fetch(url+'/data/history.sqlite')).status,404);
 }finally{await new Promise(r=>server.close(r));}
});
