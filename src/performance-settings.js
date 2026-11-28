// Client-only rendering preferences; never read by engine or server.
const KEY='ab-performance-v1';
export const PRESETS=Object.freeze({
 saver:Object.freeze({fps:20,scale:.75,afterimages:false,damageNumbers:false,effectLimit:60,grid:false}),
 balanced:Object.freeze({fps:30,scale:1,afterimages:true,damageNumbers:true,effectLimit:120,grid:true}),
 high:Object.freeze({fps:60,scale:1,afterimages:true,damageNumbers:true,effectLimit:220,grid:true})
});
export function normalizeSettings(v){
 const preset=Object.hasOwn(PRESETS,v?.preset)?v.preset:'balanced';
 return {preset,keepAwake:typeof v?.keepAwake==='boolean'?v.keepAwake:true,reducedMotion:typeof v?.reducedMotion==='boolean'?v.reducedMotion:!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches};
}
export function loadSettings(){try{return normalizeSettings(JSON.parse(localStorage.getItem(KEY)||'null'));}catch{return normalizeSettings(null);}}
export function saveSettings(v){const clean=normalizeSettings(v);try{localStorage.setItem(KEY,JSON.stringify(clean));}catch{}return clean;}
export function renderProfile(v){const s=normalizeSettings(v),p=PRESETS[s.preset];return {...p,afterimages:p.afterimages&&!s.reducedMotion,damageNumbers:p.damageNumbers&&!s.reducedMotion};}
export function arenaPoint(bounds,clientX,clientY){return {x:(clientX-bounds.left)*720/bounds.width,y:(clientY-bounds.top)*520/bounds.height};}
export function createFrameGate(){let next=null;return {reset(){next=null;},due(now,fps){const interval=1000/fps;if(next===null||now>=next-1){next=next===null||now-next>interval?now+interval:next+interval;return true;}return false;}};}
export function createPerformanceAdvisor(){
 let count=0,slow=0,cost=0,windows=0;
 return {reset(){count=slow=cost=windows=0;},observe({elapsed,work,fps,preset}){
  if(!Number.isFinite(elapsed)||!Number.isFinite(work)||elapsed<0||work<0)return null;
  count++;cost+=work;if(elapsed>Math.max(50,1.6*1000/fps))slow++;
  if(count<60)return null;
  const poor=slow/count>.25||cost/count>.65*1000/fps;
  windows=poor?windows+1:0;count=slow=cost=0;
  if(windows<2)return null;
  windows=0;return preset==='high'?'balanced':preset==='balanced'?'saver':null;
 }};
}
