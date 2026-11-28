// Strictly bounded, optional first-party telemetry. Logs contain no IP, UA,
// account credential, match token, seed or actions. Opted-in events may include a scoped guest pseudonym.
const keys=['id','seq','seconds','soloSeconds','quickSeconds','starts','finishes','exits'];
export function validPlaytest(v){
 if(Object.keys(v).length!==keys.length||!keys.every(k=>Object.hasOwn(v,k)))return false;
 if(typeof v.id!=='string'||!/^\w{8}-\w{4}-\w{4}-\w{4}-\w{12}$/.test(v.id))return false;
 const nums=keys.slice(1);if(!nums.every(k=>Number.isSafeInteger(v[k])&&v[k]>=0))return false;
 return v.seq>0&&v.seq<=100000&&v.seconds<=86400&&v.starts>0&&v.starts<=1000&&v.finishes+v.exits<=v.starts&&v.soloSeconds+v.quickSeconds<=v.seconds&&v.seconds-v.soloSeconds-v.quickSeconds<=2;
}
export function createPlaytestSink({write=entry=>console.log(JSON.stringify(entry)),now=Date.now}={}){
 let start=now(),count=0;
 return (v,guestAnalyticsId)=>{
  if(!validPlaytest(v))return 400;
  const t=now();if(t-start>=60000){start=t;count=0;}
  if(count>=600)return 429;
  count++;write({event:guestAnalyticsId?'playtest_session_v2':'playtest_session_v1',...(guestAnalyticsId?{guest:guestAnalyticsId}:{}),...Object.fromEntries(keys.map(k=>[k,v[k]]))});return 200;
 };
}
