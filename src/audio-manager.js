// Client presentation only; no simulation imports or engine RNG.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const MAX_VOICES=4;
export const CUES=Object.freeze({
 heavy:['attack',2,.72],light:['attack',2,.65],pluck:['attack',2,.7],
 impact:['impact',1,.48],guard:['defense',4,.63],utility:['utility',3,.55],
 click:['ui',1,.6],confirm:['ui',3,.65],start:['transition',5,.65],finish:['transition',5,.55]
});
const GAP={attack:.23,impact:.28,defense:.32,utility:.4,ui:.12,transition:.6};
export function classifyAudioEvent(e){
 if(e.kind==='attackCommit')return {bruiser:'heavy',rogue:'light',ranged:'pluck'}[e.type]||null;
 if(e.kind==='impact'||e.kind==='damage')return 'impact';
 if(e.kind==='reaction')return ['bulwark','guard','block','resolve'].includes(e.ability)?'guard':'utility';
 if(e.kind==='mobility')return e.ability==='dodge'?'light':'utility';
 if(e.kind==='chain')return 'utility';
 return null;
}
export function selectAudioEvents(events){
 const groups=new Map();
 for(const e of events||[]){
  const cue=classifyAudioEvent(e);if(!Object.hasOwn(CUES,cue))continue;
  const [group,priority]=CUES[cue],old=groups.get(group);
  if(!old||priority>old.priority)groups.set(group,{cue,x:e.x,priority});
 }
 return [...groups.values()].sort((a,b)=>b.priority-a.priority);
}
export function createAudioManager({createContext=()=>{const C=globalThis.AudioContext||globalThis.webkitAudioContext;return C?new C():null;},fetchAsset=url=>fetch(url),random=Math.random}={}){
 let ctx=null,master=null,combat=null,ui=null,hidden=false,unsupported=false,pending=null,loading=null;
 let prefs={soundEnabled:true,combatVolume:30,interfaceVolume:25};
 const buffers=new Map(),voices=new Set(),lastGroup=new Map();let lastCombat=-Infinity;
 function stop(channel){
  for(const v of [...voices])if(!channel||v.channel===channel){try{v.source.stop();}catch{}voices.delete(v);}
 }
 function levels(){
  if(!ctx||!master)return;
  const t=ctx.currentTime;
  master.gain.setTargetAtTime(prefs.soundEnabled&&!hidden?.32:0,t,.015);
  combat.gain.setTargetAtTime(clamp(prefs.combatVolume/100,0,1),t,.015);
  ui.gain.setTargetAtTime(clamp(prefs.interfaceVolume/100,0,1),t,.015);
 }
 function configure(value){
  prefs={soundEnabled:value.soundEnabled,combatVolume:value.combatVolume,interfaceVolume:value.interfaceVolume};
  levels();
  if(!prefs.soundEnabled||(!prefs.combatVolume&&!prefs.interfaceVolume)){stop();ctx?.suspend().catch(()=>{});}
  else{if(!prefs.combatVolume)stop('combat');if(!prefs.interfaceVolume)stop('ui');}
 }
 function load(){
  if(!loading)loading=Promise.allSettled(Object.keys(CUES).map(async name=>{
   const response=await fetchAsset(new URL('../assets/audio/'+name+'.ogg',import.meta.url).href);
   if(!response.ok)throw Error('Audio unavailable');
   const decoded=await ctx.decodeAudioData(await response.arrayBuffer());
   buffers.set(name,decoded);
  }));
  return loading;
 }
 async function unlock(){
  if(unsupported||hidden||!prefs.soundEnabled||(!prefs.combatVolume&&!prefs.interfaceVolume))return false;
  if(pending)return pending;
  pending=(async()=>{
   try{
    if(!ctx){
     ctx=createContext();if(!ctx){unsupported=true;return false;}
     master=ctx.createGain();combat=ctx.createGain();ui=ctx.createGain();
     master.gain.value=0;combat.connect(master);ui.connect(master);master.connect(ctx.destination);levels();
    }
    if(ctx.state!=='running')await ctx.resume();
    if(hidden||!prefs.soundEnabled||(!prefs.combatVolume&&!prefs.interfaceVolume)){await ctx.suspend();return false;}
    if(ctx.state==='running'){load();return true;}
    return false;
   }catch{return false;}
  })();
  try{return await pending;}finally{pending=null;}
 }
 function play(name,x=360){
  if(!ctx||ctx.state!=='running'||hidden||!prefs.soundEnabled||!buffers.has(name))return false;
  const [group,priority,level]=CUES[name],channel=group==='ui'||group==='transition'?'ui':'combat';
  if(!(channel==='ui'?prefs.interfaceVolume:prefs.combatVolume))return false;
  const now=ctx.currentTime;
  if(now-(lastGroup.get(group)??-Infinity)<GAP[group])return false;
  if(channel==='combat'&&now-lastCombat<.16)return false;
  if(voices.size>=MAX_VOICES){
   const low=[...voices].sort((a,b)=>a.priority-b.priority)[0];if(low.priority>=priority)return false;
   try{low.source.stop();}catch{}voices.delete(low);
  }
  try{
   const source=ctx.createBufferSource();source.buffer=buffers.get(name);
   source.playbackRate.value=.94+random()*.12;
   const gain=ctx.createGain(),length=Math.min(source.buffer.duration/source.playbackRate.value,group==='transition'?.65:.28);
   gain.gain.setValueAtTime(level,now);gain.gain.setValueAtTime(level,now+Math.max(0,length-.025));gain.gain.linearRampToValueAtTime(0,now+length);
   source.connect(gain);const target=channel==='ui'?ui:combat;
   const pan=channel==='combat'&&ctx.createStereoPanner?ctx.createStereoPanner():null;
   if(pan){pan.pan.value=clamp((Number.isFinite(x)?x:360)/360-1,-1,1)*.3;gain.connect(pan);pan.connect(target);}else gain.connect(target);
   const voice={source,priority,channel};voices.add(voice);
   source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();pan?.disconnect();};
   try{source.start(now);source.stop(now+length);}catch(e){voices.delete(voice);source.disconnect();gain.disconnect();pan?.disconnect();throw e;}
   lastGroup.set(group,now);if(channel==='combat')lastCombat=now;return true;
  }catch{return false;}
 }
 function events(list){for(const e of selectAudioEvents(list))if(play(e.cue,e.x))break;}
 function visibility(value){
  hidden=!!value;levels();
  if(hidden){stop();ctx?.suspend().catch(()=>{});}
  else if(ctx&&prefs.soundEnabled&&(prefs.combatVolume||prefs.interfaceVolume))unlock();
 }
 async function preview(){if(await unlock()){await loading;return play('confirm');}return false;}
 return {configure,unlock,play,events,visibility,stop,preview,get voiceCount(){return voices.size;}};
}
