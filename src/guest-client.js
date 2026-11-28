// The credential is HttpOnly; browser JavaScript receives only the public nickname.
let pending;
export function loadGuest(){
 if(!pending){
  const request=async()=>{
   const res=await fetch('./api/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(10000)});
   if(!res.ok||!res.headers.get('content-type')?.includes('application/json'))throw Error('Guest profile unavailable');
   const profile=await res.json();if(typeof profile.name!=='string')throw Error('Guest profile unavailable');return profile;
  };
  // Serializes first-time issuance across tabs where Web Locks is supported.
  pending=(globalThis.navigator?.locks?.request?globalThis.navigator.locks.request('ab-guest-init',request):request()).catch(e=>{pending=null;throw e;});
 }
 return pending;
}
