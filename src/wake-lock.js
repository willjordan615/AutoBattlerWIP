// Use the native Screen Wake Lock API, never media playback or a network heartbeat.
export function shouldKeepAwake({enabled,hidden,phase,paused}){
 return !!enabled&&!hidden&&(['queue','draft','results'].includes(phase)||phase==='fight'&&!paused);
}
export function createScreenWakeLock({request=globalThis.navigator?.wakeLock?.request?.bind(globalThis.navigator.wakeLock),onStatus=()=>{},now=Date.now}={}){
 let wanted=false,held=null,pending=false,generation=0,lastAttempt=-Infinity;
 const report=state=>onStatus(state);
 const release=lock=>{try{Promise.resolve(lock.release()).catch(()=>{});}catch{}};
 async function acquire(){
  if(!wanted||held||pending||!request)return;
  pending=true;lastAttempt=now();const ticket=generation;
  try{
   const lock=await request('screen');
   if(!wanted||ticket!==generation){release(lock);return;}
   if(lock.released){report('unavailable');return;}
   held=lock;report('active');
   lock.addEventListener?.('release',()=>{if(held===lock){held=null;report(wanted?'unavailable':'idle');}});
  }catch{if(wanted&&ticket===generation)report('unavailable');}
  finally{pending=false;if(wanted&&ticket!==generation)void acquire();}
 }
 function update(active,{retry=false}={}){
  active=!!active;
  if(active!==wanted){
   wanted=active;generation++;
   if(!active){const lock=held;held=null;if(lock)release(lock);report(request?'idle':'unsupported');}
   else if(request)void acquire();else report('unsupported');
  }else if(active&&retry&&!held&&!pending&&now()-lastAttempt>=30000)void acquire();
 }
 return {update,supported:!!request};
}
