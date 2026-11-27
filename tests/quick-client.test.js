import test from 'node:test';
import assert from 'node:assert/strict';
import {QuickClient} from '../src/quick-client.js';
const response=(body,status=200,type='application/json')=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':type}});
test('client serializes authenticated revision-bound picks and never forwards token to UI',async()=>{
 const calls=[],states=[];const client=new QuickClient({onState:s=>states.push(s),pollMs:1e9,fetcher:async(path,opts)=>{calls.push({path,opts});return path.endsWith('join')?response({token:'secret',status:'matched',revision:1}):response({status:'matched',revision:2});}});
 try{await client.start('rogue');assert.equal(states[0].token,undefined);assert.equal(calls[0].opts.headers.Authorization,undefined);assert.ok(await client.pick('1-0',0,1));assert.equal(calls[1].opts.headers.Authorization,'Bearer secret');assert.deepEqual(JSON.parse(calls[1].opts.body),{uid:'1-0',slot:0,passiveSlot:1,revision:1});assert.equal(client.revision,2);}finally{client.stop(false);}
});
test('static-only hosting returns actionable Quick Play error',async()=>{
 let error;const client=new QuickClient({onError:(e,t)=>error=[e.message,t],fetcher:async()=>response({},404,'text/html')});await client.start('bruiser');assert.match(error[0],/hosted multiplayer server/);assert.equal(error[1],true);client.stop(false);
});

test('confirm during a poll waits for the poll instead of silently dropping the pick',async()=>{
 let unblock;const calls=[];const client=new QuickClient({pollMs:1e9,fetcher:async(path,opts)=>{
  calls.push(path);if(path.endsWith('join'))return response({token:'secret',status:'matched',revision:1});
  if(path.includes('state'))return new Promise(resolve=>{unblock=()=>resolve(response({status:'matched',revision:1}));});
  return response({status:'matched',revision:2});
 }});
 try{await client.start('ranged');const poll=client.poll();const pick=client.pick('1-0',0,0);unblock();await poll;assert.equal(await pick,true);assert.equal(calls.filter(x=>x.endsWith('pick')).length,1);}finally{client.stop(false);}
});
