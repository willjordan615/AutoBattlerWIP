// Optional, first-party playtest measurements. No persistent identifier.
const KEY='autobattler-share-playtest';
export function analyticsPreference(){try{return localStorage.getItem(KEY)==='yes';}catch{return false;}}
export function createPlayAnalytics({now=()=>performance.now(),visible=()=>!document.hidden,send=data=>fetch('./api/playtest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),keepalive:true}).then(r=>{if(!r.ok)throw Error('Playtest unavailable');}),makeId=()=>globalThis.crypto?.randomUUID?.()}={}){
 let enabled=false,id=null,last=now(),active=false,shown=visible(),mode=null,matchActive=false,seconds=0,soloSeconds=0,quickSeconds=0,starts=0,finishes=0,exits=0,seq=0,lastSnapshot='';
 const accrue=()=>{const t=now();if(enabled&&active&&shown){const dt=Math.max(0,t-last)/1000;seconds+=dt;if(mode==='solo')soloSeconds+=dt;else if(mode==='quick')quickSeconds+=dt;}last=t;};
 const flush=()=>{accrue();if(!enabled||!id||!starts)return;const snapshot={seconds:Math.floor(seconds),soloSeconds:Math.floor(soloSeconds),quickSeconds:Math.floor(quickSeconds),starts,finishes,exits};const signature=JSON.stringify(snapshot);if(signature===lastSnapshot)return;lastSnapshot=signature;try{Promise.resolve(send({id,seq:++seq,...snapshot})).catch(()=>{lastSnapshot='';});}catch{lastSnapshot='';}};
 return {
  enable(value){accrue();if(value===enabled)return;enabled=value;try{localStorage.setItem(KEY,value?'yes':'no');}catch{}if(!value){id=null;active=false;matchActive=false;mode=null;seconds=soloSeconds=quickSeconds=starts=finishes=exits=seq=0;lastSnapshot='';}},
  update({playing=false,phase,mode:nextMode}={}){
   accrue();if(!enabled)return;
   const inMatch=['draft','fight','results','over'].includes(phase);
   let changed=false;
   if(inMatch&&phase!=='over'&&!matchActive){id||=makeId();if(!id)return;matchActive=true;starts++;changed=true;}
   if(matchActive&&phase==='over'){matchActive=false;finishes++;changed=true;}
   else if(matchActive&&!inMatch){matchActive=false;exits++;changed=true;}
   mode=nextMode;active=playing&&matchActive;shown=visible();
   if(changed)flush();
  },
  visibility(){accrue();shown=visible();if(!shown)flush();},
  flush
 };
}
