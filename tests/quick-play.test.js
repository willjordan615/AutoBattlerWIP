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
test('four queue players start immediately, banks accrue only on active seat and cap at 30s',()=>{
 const {q,advance}=setup(),a=join4(q);let s=q.get(a[0].token);assert.equal(s.turn,0);advance(3000);s=q.get(a[0].token);assert.deepEqual(s.clocks,[17000,20000,20000,20000]);s=pick(q,a[0].token,s);assert.equal(s.clocks[0],21000);assert.equal(s.turn,1);assert.throws(()=>pick(q,a[0].token),/Not your draft turn/);
 for(let i=1;i<4;i++)pick(q,a[i].token);
 s=q.get(a[0].token);assert.equal(s.phase,'combat');assert.equal(s.match.phase,'combat');assert.equal(s.result,null);
 advance(s.deadline-s.serverNow);s=q.get(a[0].token);assert.ok(['results','finished'].includes(s.phase));assert.ok(s.result.ranking.length===4);assert.equal(s.clocks[0],21000);
});
test('timeout makes exactly one automatic pick and restores four seconds; reconnect does not reset bank',()=>{
 const {q,advance}=setup(),a=join4(q);advance(19999);assert.equal(q.get(a[0].token).clocks[0],1);advance(1);
 const s=q.get(a[0].token);assert.equal(s.clocks[0],4000);assert.equal(s.turn,1);assert.equal(s.match.draft.picks.length,1);assert.equal(s.match.draft.picks[0].automatic,true);assert.throws(()=>q.pick(a[0].token,{uid:'1-0',slot:0,passiveSlot:0,revision:1}),/Not your draft turn/);
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
  const response=await fetch(url+'/api/quick/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'rogue'})});assert.equal(response.status,200);const a=await response.json();
  assert.equal((await fetch(url+'/api/quick/state')).status,401);
  const state=await (await fetch(url+'/api/quick/state',{headers:{Authorization:'Bearer '+a.token}})).json();assert.equal(state.status,'queued');assert.equal(state.token,undefined);
 }finally{await new Promise(r=>server.close(r));}
});

test('unused draft time is banked across rounds and capped at 30 seconds',()=>{
 const {q,advance}=setup(),a=join4(q);let s=q.get(a[0].token);
 for(let round=1;round<=3;round++){
  while(s.phase==='draft'){
   const i=s.turn,p=s.match.players[i],card=s.match.draft.pool.find(c=>legal(p,c));
   const slot=card.kind==='unit'?0:p.squad.findIndex(u=>canEquip(u,card));
   q.pick(a[i].token,{uid:card.uid,slot,passiveSlot:0,revision:s.revision});s=q.get(a[0].token);
  }
  assert.equal(s.phase,'combat');assert.equal(s.clocks[0],Math.min(30000,20000+round*4000));
  const replay=structuredClone(s.match),battle=beginCombat(replay);
  let end=null;for(let j=0;j<900;j++){end=tick(battle,STEP);if(end!==null)break;}
  assert.notEqual(end,null);const expected=rankRound(replay,battle);
  advance(s.deadline-s.serverNow);s=q.get(a[0].token);assert.deepEqual(s.result.ranking,expected);
  assert.equal(s.phase,'results');advance(RULES.resultMs);s=q.get(a[0].token);
 }
});
test('two clients share one match and can resume without resetting a running clock',async()=>{
 const {q,advance}=setup(),server=createApp({service:q});await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
 const state=[null,null],clients=[0,1].map(i=>new QuickClient({onState:s=>state[i]=s,pollMs:1e9,fetcher:(path,opts)=>fetch(new URL(path,url),opts)}));
 try{
  await clients[0].start('rogue');advance(60000);await clients[1].start('ranged');advance(60000);
  await clients[0].poll();await clients[1].poll();assert.deepEqual(state[0].humans,[true,true,false,false]);assert.equal(state[0].seat,0);assert.equal(state[1].seat,1);assert.equal(state[0].match.seed,state[1].match.seed);
  advance(2000);const token=clients[0].token;clients[0].stop(false);
  const resumed=new QuickClient({onState:s=>state[0]=s,pollMs:1e9,fetcher:(path,opts)=>fetch(new URL(path,url),opts)});clients[0]=resumed;await resumed.resume(token);assert.equal(state[0].clocks[0],18000);
  assert.ok(await resumed.pick(state[0].match.draft.pool[0].uid,0,0));await clients[1].poll();assert.equal(state[1].turn,1);assert.ok(await clients[1].pick(state[1].match.draft.pool[0].uid,0,0));await resumed.poll();assert.equal(state[0].phase,'combat');assert.equal(state[1].phase,'combat');assert.deepEqual(state[0].match.draft.picks,state[1].match.draft.picks);
  advance(state[0].deadline-state[0].serverNow);await resumed.poll();await clients[1].poll();assert.deepEqual(state[0].result,state[1].result);assert.equal(state[0].clocks[0],22000);
 }finally{clients.forEach(c=>c.stop(false));await new Promise(r=>server.close(r));}
});
