import test from 'node:test';
import assert from 'node:assert/strict';
import {createScreenWakeLock,shouldKeepAwake} from '../src/wake-lock.js';
const settle=()=>new Promise(r=>setImmediate(r));
function fakeLock(){const listeners=[];return {released:false,addEventListener(name,cb){listeners.push(cb);},release(){this.released=true;for(const cb of listeners)cb();return Promise.resolve();}};}
test('only foreground active play or matchmaking requests wake lock',()=>{
 for(const phase of ['queue','draft','fight','results'])assert.equal(shouldKeepAwake({enabled:true,phase}),true);
 for(const phase of ['mode','start','options','over'])assert.equal(shouldKeepAwake({enabled:true,phase}),false);
 assert.equal(shouldKeepAwake({enabled:true,phase:'fight',paused:true}),false);
 assert.equal(shouldKeepAwake({enabled:true,phase:'draft',hidden:true}),false);
 assert.equal(shouldKeepAwake({enabled:false,phase:'draft'}),false);
});
test('one lock per active period, released when hidden and reacquired on return',async()=>{
 const locks=[],states=[],c=createScreenWakeLock({request:async type=>{assert.equal(type,'screen');const lock=fakeLock();locks.push(lock);return lock;},onStatus:s=>states.push(s)});
 c.update(true);c.update(true);await settle();assert.equal(locks.length,1);assert.equal(states.at(-1),'active');
 c.update(false);assert.equal(locks[0].released,true);assert.equal(states.at(-1),'idle');
 c.update(true);await settle();assert.equal(locks.length,2);c.update(false);
});
test('late lock resolution after leaving does not leak a lock',async()=>{
 let resolve;const lock=fakeLock(),c=createScreenWakeLock({request:()=>new Promise(r=>{resolve=r;})});
 c.update(true);c.update(false);resolve(lock);await settle();assert.equal(lock.released,true);
});
test('OS release is respected, retry requires interaction and cooldown',async()=>{
 let time=0;const locks=[],c=createScreenWakeLock({now:()=>time,request:async()=>{const l=fakeLock();locks.push(l);return l;}});
 c.update(true);await settle();await locks[0].release();c.update(true,{retry:true});await settle();assert.equal(locks.length,1);
 time=30000;c.update(true);await settle();assert.equal(locks.length,1);c.update(true,{retry:true});await settle();assert.equal(locks.length,2);c.update(false);
});
test('unsupported or denied wake lock is nonfatal',async()=>{
 const states=[],unsupported=createScreenWakeLock({request:null,onStatus:s=>states.push(s)});unsupported.update(true);assert.equal(states.at(-1),'unsupported');
 const denied=createScreenWakeLock({request:async()=>{throw Error('denied');},onStatus:s=>states.push(s)});denied.update(true);await settle();assert.equal(states.at(-1),'unavailable');
});
