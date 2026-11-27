// Same-origin Quick Play transport. A bearer token stays in sessionStorage;
// no names, accounts or cross-origin service configuration.
const KEY='autobattler-quick-session';
const save=id=>{try{if(id)sessionStorage.setItem(KEY,id);else sessionStorage.removeItem(KEY);}catch{}};
export function savedSession(){try{return sessionStorage.getItem(KEY);}catch{return null;}}
export class QuickClient{
 constructor({onState,onError,fetcher=globalThis.fetch,pollMs=500}={}){
  this.onState=onState;this.onError=onError;this.fetcher=fetcher;this.pollMs=pollMs;this.token=null;this.revision=null;this.closed=false;this.busy=false;this.timer=null;this.generation=0;
 }
 async request(path,method='GET',data,token=this.token){
  const headers={Accept:'application/json'};
  if(token)headers.Authorization='Bearer '+token;
  if(data!==undefined)headers['Content-Type']='application/json';
  const res=await this.fetcher('./api/quick/'+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data),cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!res.headers.get('content-type')?.includes('application/json'))throw Error('Quick Play requires the hosted multiplayer server.');
  const json=await res.json();if(!res.ok){const e=Error(json.error||'Quick Play unavailable');e.status=res.status;throw e;}return json;
 }
 accept(s){if(this.closed)return;if(s.revision!==undefined)this.revision=s.revision;this.onState?.(s);}
 schedule(){if(!this.closed&&this.token){clearTimeout(this.timer);this.timer=setTimeout(()=>this.poll(),this.pollMs);}}
 async start(type){
  const generation=this.generation;
  try{const s=await this.request('join','POST',{type},null);if(this.closed||generation!==this.generation){this.request('leave','POST',undefined,s.token).catch(()=>{});return;}this.token=s.token;save(this.token);delete s.token;this.accept(s);this.schedule();}
  catch(e){if(!this.closed)this.onError?.(e,true);}
 }
 resume(token){this.token=token;this.revision=null;return this.poll();}
 async poll(){
  if(this.closed||this.busy||!this.token)return;
  this.busy=true;try{const s=await this.request('state'+(this.revision===null?'':'?revision='+this.revision));this.accept(s);}
  catch(e){if(!this.closed){if(e.status===401){this.stop(false);this.onError?.(e,true);}else this.onError?.(e,false);}}
  finally{this.busy=false;this.schedule();}
 }
 async pick(uid,slot,passiveSlot){
  if(this.closed||this.busy||!this.token)return false;
  clearTimeout(this.timer);this.busy=true;
  try{this.accept(await this.request('pick','POST',{uid,slot,passiveSlot,revision:this.revision}));return true;}
  catch(e){if(!this.closed)this.onError?.(e,false);return false;}
  finally{this.busy=false;this.schedule();}
 }
 stop(notify=true){const id=this.token;this.closed=true;this.generation++;clearTimeout(this.timer);this.token=null;save(null);if(notify&&id)this.request('leave','POST',undefined,id).catch(()=>{});}
}
