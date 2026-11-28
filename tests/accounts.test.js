import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openHistory} from '../server/history.js';
import {createGuests} from '../server/guest.js';
import {createApp} from '../server/index.js';
const key='test-key-not-for-production-0000000000000';
const raw=cookie=>cookie.split(';')[0];
test('account conversion moves consent/history to a distinct identity, survives restart and revokes sessions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ab-accounts-')),path=join(dir,'test.sqlite');let now=1000,h=openHistory(path,{now:()=>now});
 const guest=createGuests({key}).issue().profile;
 const match={phase:'finished',players:[{name:'You',hp:4},{hp:0},{hp:0},{hp:0}],history:[{round:1,ranking:[0,1,2,3],remaining:[4,0,0,0],combatReport:[{id:0,owner:0,type:'rogue',damage:23,prevented:2}]}]};
 try{
  h.set(guest.id,true);assert.equal(h.record(guest.id,'m',match,0,now),true);
  const a=h.accounts.create(guest);assert.match(a.code,/^ab1_[A-Za-z0-9_-]{43}$/);assert.notEqual(a.account.id,guest.id);assert.equal(a.account.name,guest.name);
  assert.match(a.cookie,/HttpOnly/);assert.match(a.cookie,/SameSite=Strict/);assert.equal(h.read(guest.id).enabled,false);assert.equal(h.read(a.account.id).totals.matches,1);assert.equal(h.read(a.account.id).history[0].damage,23);
  h.close();h=openHistory(path,{now:()=>now});
  assert.equal(h.accounts.read(raw(a.cookie)).id,a.account.id);
  const b=h.accounts.signIn(a.code);assert.equal(b.account.id,a.account.id);assert.notEqual(b.cookie,a.cookie);
  assert.equal(h.accounts.signIn('ab1_'+'a'.repeat(43)),null);
  h.accounts.signOut(raw(a.cookie));assert.equal(h.accounts.read(raw(a.cookie)),null);assert.equal(h.accounts.read(raw(b.cookie)).id,a.account.id);
  now+=31*86400000;assert.equal(h.accounts.read(raw(b.cookie)),null);
  const c=h.accounts.signIn(a.code);assert.ok(c);assert.equal(h.accounts.deleteAccount(c.account.id,'ab1_'+'a'.repeat(43)),false);
  assert.equal(h.accounts.deleteAccount(c.account.id,a.code),true);assert.equal(h.accounts.read(raw(c.cookie)),null);assert.equal(h.accounts.signIn(a.code),null);assert.equal(h.read(a.account.id).enabled,false);
 }finally{h.close();rmSync(dir,{recursive:true,force:true});}
});
test('account endpoints: guest access, strict body/origin, cross-device history and one active seat',async()=>{
 const guests=createGuests({key}),server=createApp({guests});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const post=(path,data,cookie,extra={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...extra},body:JSON.stringify(data)});
 const get=(path,cookie)=>fetch(base+path,{headers:{Cookie:cookie}});
 try{
  const g=await post('/api/guest',{}),guest=raw(g.headers.get('set-cookie')),profile=await g.json();
  assert.equal((await post('/api/history',{enabled:true},guest)).status,200);
  assert.equal((await post('/api/account/create',{name:'untrusted'},guest)).status,400);
  assert.equal((await post('/api/account/create',{},guest,{Origin:'https://other.example'})).status,403);
  const queued=await (await post('/api/quick/join',{type:'rogue'},guest)).json();
  assert.equal((await post('/api/account/create',{},guest)).status,409);
  assert.equal((await post('/api/quick/leave',{},guest,{Authorization:'Bearer '+queued.token})).status,200);
  const create=await post('/api/account/create',{},guest);assert.equal(create.status,201);
  const account=raw(create.headers.get('set-cookie')),a=await create.json();assert.equal(a.name,profile.name);
  assert.equal((await (await get('/api/history',account)).json()).enabled,true);
  assert.equal((await (await get('/api/history',guest)).json()).enabled,false);
  assert.deepEqual(await (await post('/api/guest',{},account)).json(),{name:profile.name,account:true});
  const login=await post('/api/account/sign-in',{code:a.recoveryCode});assert.equal(login.status,200);
  const other=raw(login.headers.get('set-cookie'));assert.equal((await login.json()).recoveryCode,undefined);
  assert.equal((await (await get('/api/history',other)).json()).enabled,true);
  const join=await post('/api/quick/join',{type:'rogue'},account);assert.equal(join.status,200);const {token}=await join.json();
  assert.equal((await post('/api/quick/join',{type:'ranged'},other)).status,409);
  assert.equal((await post('/api/account/sign-out',{},other)).status,409);
  assert.equal((await post('/api/quick/leave',{},other,{Authorization:'Bearer '+token})).status,200);
  assert.equal((await post('/api/account/sign-out',{},other)).status,200);
  assert.equal((await (await get('/api/account',other)).json()).account,false);
  assert.equal((await post('/api/account/delete',{code:a.recoveryCode},account)).status,200);
  assert.equal((await post('/api/account/sign-in',{code:a.recoveryCode})).status,401);
  assert.equal((await (await get('/api/account',account)).json()).account,false);
 }finally{await new Promise(r=>server.close(r));}
});

test('display names preserve identity, unique stable tags, cooldown and login',()=>{
 let now=1000;const h=openHistory(':memory:',{now:()=>now}),guests=createGuests({key});
 try{
  const a=h.accounts.create(guests.issue().profile),b=h.accounts.create(guests.issue().profile);
  for(const bad of ['ab','a'.repeat(17),'123','<script>','a b','Admin','Bot123','test@example.com','Sljp#0679','f_u_c_k','sh1t'])assert.equal(h.accounts.rename(a.account.id,bad).status,400,bad);
  const x=h.accounts.rename(a.account.id,'Sljp'),y=h.accounts.rename(b.account.id,'sljp');
  assert.match(x.name,/^Sljp#[0-9]{4}$/);assert.notEqual(x.name.slice(-4),y.name.slice(-4));
  assert.equal(h.accounts.read(raw(a.cookie)).name,x.name);
  assert.equal(h.accounts.signIn(a.code).account.name,x.name);
  assert.equal(h.accounts.rename(a.account.id,'Sljp').status,200);
  assert.equal(h.accounts.rename(a.account.id,'Other').status,429);
  now+=86400000;const z=h.accounts.rename(a.account.id,'Other');assert.equal(z.name,'Other'+x.name.slice(-5));
  assert.equal(h.accounts.read(raw(a.cookie)).id,a.account.id);
 }finally{h.close();}
});
