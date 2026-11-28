import test from 'node:test';
import assert from 'node:assert/strict';
import {createGuests} from '../server/guest.js';
import {createQuickPlay} from '../server/quick-play.js';
import {createApp} from '../server/index.js';
import {createPlaytestSink} from '../server/playtest.js';
const key='test-key-not-for-production-0000000000000';
test('signed cookie survives process recreation, renews name, rejects tampering and expires',()=>{
 let t=1000000;const a=createGuests({key,secure:true,now:()=>t}),b=createGuests({key,now:()=>t});
 const {profile,cookie}=a.issue(),raw=cookie.split(';')[0];
 assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.match(cookie,/SameSite=Lax/);
 assert.deepEqual(b.read(raw),profile);assert.equal(b.issue(b.read(raw)).profile.name,profile.name);
 assert.notEqual(a.issue().profile.id,profile.id);
 assert.equal(b.read(raw.slice(0,-1)+(raw.endsWith('0')?'1':'0')),null);
 t+=366*86400000;assert.equal(b.read(raw),null);
});
test('one active seat per guest, matching guest credential required, leave releases admission',()=>{
 const q=createQuickPlay(),g={id:'one',name:'QuietFox-00001'},h={id:'two',name:'SilverOwl-00002'};
 const a=q.join('rogue',g);assert.throws(()=>q.join('ranged',g),/already queued/);
 assert.throws(()=>q.get(a.token,undefined,h.id),/expired/);
 assert.equal(q.get(a.token,undefined,g.id).status,'queued');
 const b=q.join('ranged',h);assert.equal(q.counts().queued,2);
 q.leave(a.token,g.id);assert.equal(q.join('bruiser',g).status,'queued');
 q.leave(b.token,h.id);
});
test('HTTP guest identity is separate from public name and analytics uses only scoped ID',async()=>{
 const logs=[],guests=createGuests({key}),server=createApp({guests,playtest:createPlaytestSink({write:v=>logs.push(v)})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const post=(path,data,cookie)=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(data)});
 try{
  assert.equal((await post('/api/quick/join',{type:'rogue'})).status,401);
  const first=await post('/api/guest',{}),cookie=first.headers.get('set-cookie').split(';')[0],profile=await first.json();
  assert.deepEqual(Object.keys(profile),['name']);assert.deepEqual(await (await post('/api/guest',{},cookie)).json(),profile);
  const joined=await post('/api/quick/join',{type:'rogue'},cookie);assert.equal(joined.status,200);const {token}=await joined.json();
  assert.equal((await post('/api/quick/join',{type:'ranged'},cookie)).status,409);
  const other=(await post('/api/guest',{})).headers.get('set-cookie').split(';')[0];
  assert.equal((await fetch(url+'/api/quick/state',{headers:{Authorization:'Bearer '+token,Cookie:other}})).status,401);
  const v={id:'12345678-1234-1234-1234-123456789012',seq:1,seconds:1,soloSeconds:1,quickSeconds:0,starts:1,finishes:0,exits:0};
  assert.equal((await post('/api/playtest/guest',v,cookie)).status,200);assert.equal(logs[0].guest,guests.read(cookie).analyticsId);assert.notEqual(logs[0].guest,guests.read(cookie).id);assert.equal(logs[0].name,undefined);assert.equal((await post('/api/playtest',v,cookie)).status,200);assert.equal(logs[1].guest,undefined);
 }finally{await new Promise(r=>server.close(r));}
});
