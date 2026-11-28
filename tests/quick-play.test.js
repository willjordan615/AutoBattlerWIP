import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuickPlay,RULES} from '../server/quick-play.js';
import {createApp} from '../server/index.js';
import {legal,canEquip,beginCombat,rankRound} from '../src/headless.js';
import {STEP,tick} from '../src/simulation.js';
import {QuickClient} from '../src/quick-client.js';
function setup(overrides={}){let t=1000,n=0;const q=createQuickPlay({now:()=>t,makeSeed:()=>12345,makeToken:()=>String(++n),rules:{...RULES,queueLeaseMs:1e9,abandonedMs:1e9,...overrides}});return {q,advance:ms=>{t+=ms;q.pump();},now:()=>t};}
const join4=q=>Array.from({length:4},(_,i)=>q.join(['bruiser','rogue','ranged','bruiser'][i]));
const pick=(q,token,s=q.get(token))=>q.pick(token,{uid:s.match.draft.pool[0].uid,slot:0,passiveSlot:0,revision:s.revision});
test('first queue deadline does not reset; deadline fills remaining seats with bots',()=>{
 const {q,advance}=setup();const a=q.join('rogue');advance(90000);const b=q.join('ranged');assert.equal(b.queueDeadline,a.queueDeadline);advance(29999);assert.equal(q.get(a.token).status,'queued');advance(1);const s=q.get(a.token);assert.equal(s.status,'matched');assert.deepEqual(s.humans,[true,true,false,false]);assert.equal(s.clocks[0],20000);assert.equal(s.match.players[0].squad[0].type,'rogue');assert.equal(q.get(b.token).seat,1);
});
test('four queue players start immediately and clocks run only during their own turn',()=>{
 const {q,advance}=setup(),a=join4(q);let s=q.get(a[0].token);assert.equal(s.turn,0);advance(3000);s=q.get(a[0].token);assert.deepEqual(s.clocks,[17000,20000,20000,20000]);s=pick(q,a[0].token,s);assert.equal(s.clocks[0],20000);assert.equal(s.turn,1);assert.throws(()=>pick(q,a[0].token),/Not your draft turn/);
 for(let i=1;i<4;i++)pick(q,a[i].token);
 s=q.get(a[0].token);assert.equal(s.phase,'combat');assert.equal(s.match.phase,'combat');assert.equal(s.result,null);
 advance(s.deadline-s.serverNow);s=q.get(a[0].token);assert.ok(['results','finished'].includes(s.phase));assert.ok(s.result.ranking.length===4);assert.equal(s.clocks[0],20000);
});
test('timeout makes exactly one automatic pick and reduces next allowance; reconnect preserves missed streak',()=>{
 const {q,advance}=setup(),a=join4(q);advance(19999);assert.equal(q.get(a[0].token).clocks[0],1);advance(1);
 const s=q.get(a[0].token);assert.equal(s.clocks[0],17000);assert.equal(s.turn,1);assert.equal(s.match.draft.picks.length,1);assert.equal(s.match.draft.picks[0].automatic,true);assert.throws(()=>q.pick(a[0].token,{uid:'1-0',slot:0,passiveSlot:0,revision:1}),/Not your draft turn/);
 assert.equal(q.get(a[0].token,s.revision).match,undefined);
});
test('invalid and stale picks leave the board unchanged; queue cancellation and abandonment',()=>{
 const {q}=setup();const canceled=q.join('bruiser');q.leave(canceled.token);assert.equal(q.counts().queued,0);assert.throws(()=>q.get(canceled.token),/expired/);
 const a=join4(q),s=q.get(a[0].token);assert.throws(()=>q.pick(a[0].token,{uid:'bad',slot:0,passiveSlot:0,revision:s.revision}),/Illegal/);assert.throws(()=>q.pick(a[0].token,{uid:s.match.draft.pool[0].uid,slot:0,passiveSlot:0,revision:-1}),/Draft changed/);assert.equal(q.get(a[0].token).revision,s.revision);q.leave(a[0].token);assert.equal(q.get(a[1].token).turn,1);
});
test('queue lease removes inactive entries and late arrivals do not inherit an empty queue deadline',()=>{
 const {q,advance}=setup({queueLeaseMs:20000});const a=q.join('bruiser');advance(20000);assert.throws(()=>q.get(a.token),/expired/);const b=q.join('ranged');assert.equal(b.queueDeadline,b.serverNow+RULES.queueMs);
});
test('HTTP adapter serves game and isolates session credentials',async()=>{
 const {q}=setup(),server=createApp({service:q});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 try{
  const page=await fetch(url);assert.equal(page.status,200);assert.match(await page.text(),/AutoBattler/);
  assert.equal((await fetch(url+'/server/quick-play.js')).status,404);
  const profile=await fetch(url+'/api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});const cookie=profile.headers.get('set-cookie').split(';')[0];
  const response=await fetch(url+'/api/quick/join',{method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify({type:'rogue'})});assert.equal(response.status,200);const a=await response.json();
  assert.equal((await fetch(url+'/api/quick/state')).status,401);
  const state=await (await fetch(url+'/api/quick/state',{headers:{Authorization:'Bearer '+a.token,Cookie:cookie}})).json();assert.equal(state.status,'queued');assert.equal(state.token,undefined);
 }finally{await new Promise(r=>server.close(r));}
});

test('manual picks always receive 20 seconds next round regardless of unused time',()=>{
 const {q,advance}=setup(),a=join4(q);let s=q.get(a[0].token);
 for(let round=1;round<=3;round++){
  while(s.phase==='draft'){
   const i=s.turn,p=s.match.players[i],card=s.match.draft.pool.find(c=>legal(p,c));
   const slot=card.kind==='unit'?0:p.squad.findIndex(u=>canEquip(u,card));
   q.pick(a[i].token,{uid:card.uid,slot,passiveSlot:0,revision:s.revision});s=q.get(a[0].token);
  }
  assert.equal(s.phase,'combat');assert.equal(s.clocks[0],20000);
  const replay=structuredClone(s.match),battle=beginCombat(replay);
  let end=null;for(let j=0;j<900;j++){end=tick(battle,STEP);if(end!==null)break;}
  assert.notEqual(end,null);const expected=rankRound(replay,battle);
  advance(s.deadline-s.serverNow);s=q.get(a[0].token);assert.deepEqual(s.result.ranking,expected);
  assert.equal(s.phase,'results');advance(RULES.resultMs);s=q.get(a[0].token);
 }
});
test('two clients share one match and can resume without resetting a running clock',async()=>{
 const {q,advance}=setup(),server=createApp({service:q});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
 const cookies=await Promise.all([0,1].map(async()=>{const res=await fetch(url+'api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});return res.headers.get('set-cookie').split(';')[0];}));
 const fetchFor=i=>(path,opts)=>fetch(new URL(path,url),{...opts,headers:{...opts.headers,Cookie:cookies[i]}});
 const state=[null,null],clients=[0,1].map(i=>new QuickClient({onState:s=>state[i]=s,pollMs:1e9,fetcher:fetchFor(i)}));
 try{
  await clients[0].start('rogue');advance(60000);await clients[1].start('ranged');advance(60000);
  await clients[0].poll();await clients[1].poll();assert.deepEqual(state[0].humans,[true,true,false,false]);assert.equal(state[0].seat,0);assert.equal(state[1].seat,1);assert.equal(state[0].match.seed,state[1].match.seed);
  advance(2000);const token=clients[0].token;clients[0].stop(false);
  const resumed=new QuickClient({onState:s=>state[0]=s,pollMs:1e9,fetcher:fetchFor(0)});clients[0]=resumed;await resumed.resume(token);assert.equal(state[0].clocks[0],18000);
  assert.ok(await resumed.pick(state[0].match.draft.pool[0].uid,0,0));await clients[1].poll();assert.equal(state[1].turn,1);assert.ok(await clients[1].pick(state[1].match.draft.pool[0].uid,0,0));await resumed.poll();assert.equal(state[0].phase,'combat');assert.equal(state[1].phase,'combat');assert.deepEqual(state[0].match.draft.picks,state[1].match.draft.picks);
  advance(state[0].deadline-state[0].serverNow);await resumed.poll();await clients[1].poll();assert.deepEqual(state[0].result,state[1].result);assert.equal(state[0].clocks[0],20000);
 }finally{clients.forEach(c=>c.stop(false));await new Promise(r=>server.close(r));}
});

test('consecutive misses shorten subsequent turns by three seconds, manual pick clears streak',()=>{
 const {q,advance}=setup(),a=join4(q);let s=q.get(a[0].token);
 // Everyone times out in the first two rounds; all four remain active.
 for(let round=0;round<2;round++){
  while(s.phase==='draft'){
   const seat=s.turn,ms=20000-round*3000;
   assert.equal(s.clocks[seat],ms);assert.equal(s.missed[seat],round);
   advance(ms);s=q.get(a[0].token);
   assert.equal(s.missed[seat],round+1);assert.equal(s.clocks[seat],ms-3000);
  }
  assert.equal(s.phase,'combat');advance(s.deadline-s.serverNow);s=q.get(a[0].token);assert.equal(s.phase,'results');
  advance(RULES.resultMs);s=q.get(a[0].token);
 }
 const i=s.turn,p=s.match.players[i],card=s.match.draft.pool.find(c=>legal(p,c)),slot=card.kind==='unit'?0:p.squad.findIndex(u=>canEquip(u,card));
 assert.equal(s.clocks[i],14000);advance(5000);s=q.get(a[i].token);
 s=q.pick(a[i].token,{uid:card.uid,slot,passiveSlot:0,revision:s.revision});assert.equal(s.missed[i],0);assert.equal(s.clocks[i],20000);
 for(let seat=0;seat<4;seat++)if(seat!==i)assert.equal(s.missed[seat],2);
});
test('miss penalty has a recoverable lower bound and no negative deadlines',()=>{
 const {q,advance}=setup({initialMs:8000}),a=join4(q);let s=q.get(a[0].token);
 for(let round=0;round<2;round++){
  while(s.phase==='draft'){const seat=s.turn;assert.equal(s.clocks[seat],round===0?8000:5000);advance(s.clocks[seat]);s=q.get(a[0].token);assert.equal(s.clocks[seat],5000);}
  advance(s.deadline-s.serverNow);advance(RULES.resultMs);s=q.get(a[0].token);
 }
 assert.equal(s.clocks[s.turn],5000);
});

test('finished guests can rejoin the same FIFO with newcomers and old leave cannot remove new seat',()=>{
 const {q,advance}=setup();
 const guests=Array.from({length:5},(_,i)=>({id:'guest-'+i,name:'Guest-'+i}));
 const types=['rogue','ranged','bruiser','rogue'];
 const old=types.map((type,i)=>q.join(type,guests[i]));
 const read=()=>q.get(old[0].token,undefined,guests[0].id);
 let s=read();
 for(let i=0;i<250&&s.phase!=='finished';i++){
  if(s.phase==='draft'){const seat=s.turn,p=s.match.players[seat],card=s.match.draft.pool.find(c=>legal(p,c)),slot=card.kind==='unit'?0:p.squad.findIndex(u=>canEquip(u,card));q.pick(old[seat].token,{uid:card.uid,slot,passiveSlot:0,revision:s.revision},guests[seat].id);}
  else advance(Math.max(1,s.deadline-s.serverNow));
  s=read();
 }
 assert.equal(s.phase,'finished');
 const newcomer=q.join('bruiser',guests[4]);
 const replay=q.join(types[0],guests[0]);
 assert.equal(replay.queueDeadline,newcomer.queueDeadline);
 assert.notEqual(replay.token,old[0].token);
 assert.throws(()=>q.join('ranged',guests[0]),/already queued/);
 q.leave(old[0].token,guests[0].id);
 assert.equal(q.get(replay.token,undefined,guests[0].id).status,'queued');
 q.join(types[1],guests[1]);q.join(types[2],guests[2]);
 const next=q.get(replay.token,undefined,guests[0].id);
 assert.equal(next.phase,'draft');assert.equal(next.seat,1);assert.equal(next.types[1],types[0]);assert.equal(next.match.round,1);assert.equal(next.match.players[1].hp,100);assert.equal(next.missed[1],0);
 assert.deepEqual(next.humans,[true,true,true,true]);assert.equal(q.get(newcomer.token,undefined,guests[4].id).seat,0);
});
