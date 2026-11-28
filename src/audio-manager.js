// Client presentation only; no simulation imports or engine RNG.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const MAX_VOICES=6;
export const MAX_COMBAT_BURST=3;
const BURST_WINDOW=.25;
export const CUES=Object.freeze({
 heavy:['attack',2,.65],light:['attack',2,.60],pluck:['attack',2,.62],
 impact:['impact',1,.40],guard:['defense',4,.56],utility:['utility',3,.48],
 click:['ui',1,.52],confirm:['ui',3,.58],start:['transition',5,.50],finish:['transition',5,.50]
});
const GAP={attack:.15,impact:.18,defense:.23,utility:.30,ui:.12,transition:.6};
const clipLength=group=>group==='transition'?.65:group==='ui'?.28:.40;
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
export function createAudioManager({createContext=()=>{const C=globalThis.AudioContext||globalThis.webkitAudioContext;return C?new C():null;},fetchAsset=url=>fetch(url),makeMedia=url=>typeof Audio==='function'?new Audio(url):null,random=Math.random,onStatus=()=>{}}={}){
 let ctx=null,master=null,combat=null,ui=null,hidden=false,unsupported=false,loading=null,backend='web',loadFailed=false;
 const assetUrl=name=>new URL('../assets/audio/'+name+(name==='pluck'?'.wav':'.ogg'),import.meta.url).href;
 const media=new Map();let previewMedia=null;
 const status=(message)=>{try{onStatus(message);}catch{}};
 const enabled=()=>prefs.soundEnabled&&!hidden&&!!(prefs.combatVolume||prefs.interfaceVolume);
 let prefs={soundEnabled:true,combatVolume:30,interfaceVolume:25};
 const buffers=new Map(),voices=new Set(),lastGroup=new Map();
 const bursts={web:[],media:[]};
 function canStartCombat(kind,now){const times=bursts[kind];while(times.length&&now-times[0]>=BURST_WINDOW)times.shift();return times.length<MAX_COMBAT_BURST;}
 function stop(channel){
  for(const v of [...voices])if(!channel||v.channel===channel){try{v.stop?v.stop():v.source.stop();}catch{}voices.delete(v);}
  if(!channel||channel==='ui'){try{previewMedia?.pause();}catch{}previewMedia=null;}
 }
 function levels(){
  if(!ctx||!master)return;
  const t=ctx.currentTime;
  master.gain.setTargetAtTime(prefs.soundEnabled&&!hidden?.62:0,t,.015);
  combat.gain.setTargetAtTime(clamp(prefs.combatVolume/100,0,1),t,.015);
  ui.gain.setTargetAtTime(clamp(prefs.interfaceVolume/100,0,1),t,.015);
 }
 function configure(value){
  prefs={soundEnabled:value.soundEnabled,combatVolume:value.combatVolume,interfaceVolume:value.interfaceVolume};
  levels();
  for(const v of voices)if(v.element)v.element.volume=mediaVolume(v.name);
  if(!prefs.soundEnabled||(!prefs.combatVolume&&!prefs.interfaceVolume)){stop();ctx?.suspend().catch(()=>{});}
  else{if(!prefs.combatVolume)stop('combat');if(!prefs.interfaceVolume)stop('ui');}
 }
 function load(){
  if(!loading)loading=Promise.allSettled(Object.keys(CUES).map(async name=>{
   const response=await fetchAsset(assetUrl(name));
   if(!response.ok)throw Error('Audio unavailable');
   const decoded=await ctx.decodeAudioData(await response.arrayBuffer());
   buffers.set(name,decoded);
  })).then(results=>{loadFailed=results.some(x=>x.status==='rejected');if(!buffers.size){backend='media';status('Using native audio playback.');}else status('Sound ready · '+buffers.size+'/'+Object.keys(CUES).length+' clips loaded.');});
  return loading;
 }
 // Call resume directly within every trusted activation. Never share a pending
 // resume promise from an earlier, non-activating touch event.
 async function unlock(){
  if(!enabled())return false;
  if(backend==='media')return true;
  try{
   if(!ctx&&!unsupported){
    ctx=createContext();
    if(!ctx){unsupported=true;backend='media';return true;}
    master=ctx.createGain();combat=ctx.createGain();ui=ctx.createGain();
    master.gain.value=.62;combat.connect(master);ui.connect(master);master.connect(ctx.destination);levels();
   }
   if(!ctx){backend='media';return true;}
   if(ctx.state!=='running'){
    const resumed=ctx.resume(); // synchronous invocation in gesture handler
    const ok=await Promise.race([resumed.then(()=>true,()=>false),new Promise(resolve=>setTimeout(()=>resolve(false),900))]);
    if(!ok||ctx.state!=='running')return backend==='media';
   }
   if(!enabled()){await ctx.suspend();return false;}
   load();return true;
  }catch{backend='media';return true;}
 }
 function mediaVolume(name){
  const [group,,level]=CUES[name],v=group==='ui'||group==='transition'?prefs.interfaceVolume:prefs.combatVolume;
  return clamp(.62*level*v/100,0,1);
 }
 function nativePlay(name,{preview=false}={}){
  if(!enabled()||!Object.hasOwn(CUES,name)||mediaVolume(name)===0)return false;
  const [group,priority]=CUES[name],channel=group==='ui'||group==='transition'?'ui':'combat';
  const now=(globalThis.performance?.now?.()??Date.now())/1000;
  if(!preview&&(now-(lastGroup.get('media-'+group)??-Infinity)<GAP[group]||channel==='combat'&&!canStartCombat('media',now)))return false;
  if(voices.size>=MAX_VOICES){
   const low=[...voices].sort((a,b)=>a.priority-b.priority)[0];if(!preview&&low.priority>=priority)return false;
   try{low.stop?low.stop():low.source.stop();}catch{}voices.delete(low);
  }
  try{
   // Reuse a per-cue element; skip if it is already playing.
   let element=media.get(name);
   if(!element){element=makeMedia(assetUrl(name));if(!element)return false;element.preload='auto';media.set(name,element);}
   if([...voices].some(v=>v.element===element)){if(!preview)return false;for(const v of [...voices])if(v.element===element)v.stop();}
   element.volume=mediaVolume(name);element.playbackRate=.97+random()*.06;element.currentTime=0;
   let timer=null;
   const voice={element,name,channel,priority,stop:()=>{clearTimeout(timer);element.pause();voices.delete(voice);if(previewMedia===element)previewMedia=null;}};
   element.onended=()=>voice.stop();
   element.onerror=()=>{voice.stop();if(preview){if(ctx)backend='web';status('Audio file could not be played. Check browser media support.');}};
   voices.add(voice);if(preview)previewMedia=element;
   // play() must be invoked before yielding to preserve mobile user activation.
   Promise.resolve(element.play()).then(()=>{
    if(!voices.has(voice))return;
    timer=setTimeout(()=>voice.stop(),clipLength(group)*1000);
    if(preview)status('Preview playing · native audio.');
   }).catch(()=>{voice.stop();if(preview){if(ctx)backend='web';status('Browser blocked audio or could not decode this clip. Tap Preview again.');}});
   lastGroup.set('media-'+group,now);if(channel==='combat')bursts.media.push(now);return true;
  }catch{if(preview)status('Native audio is unavailable in this browser.');return false;}
 }
 function play(name,x=360){
  if(!enabled()||!Object.hasOwn(CUES,name))return false;
  if(backend==='media')return nativePlay(name);
  if(!ctx||ctx.state!=='running'||!buffers.has(name))return loadFailed?nativePlay(name):false;
  const [group,priority,level]=CUES[name],channel=group==='ui'||group==='transition'?'ui':'combat';
  if(!(channel==='ui'?prefs.interfaceVolume:prefs.combatVolume))return false;
  const now=ctx.currentTime;
  if(now-(lastGroup.get(group)??-Infinity)<GAP[group])return false;
  if(channel==='combat'&&!canStartCombat('web',now))return false;
  if(voices.size>=MAX_VOICES){
   const low=[...voices].sort((a,b)=>a.priority-b.priority)[0];if(low.priority>=priority)return false;
   try{low.stop?low.stop():low.source.stop();}catch{}voices.delete(low);
  }
  try{
   const source=ctx.createBufferSource();source.buffer=buffers.get(name);
   source.playbackRate.value=.97+random()*.06;
   const gain=ctx.createGain(),length=Math.min(source.buffer.duration/source.playbackRate.value,clipLength(group));
   gain.gain.setValueAtTime(level,now);gain.gain.setValueAtTime(level,now+Math.max(0,length-.025));gain.gain.linearRampToValueAtTime(0,now+length);
   source.connect(gain);const target=channel==='ui'?ui:combat;
   const pan=channel==='combat'&&ctx.createStereoPanner?ctx.createStereoPanner():null;
   if(pan){pan.pan.value=clamp((Number.isFinite(x)?x:360)/360-1,-1,1)*.3;gain.connect(pan);pan.connect(target);}else gain.connect(target);
   const voice={source,priority,channel};voices.add(voice);
   source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();pan?.disconnect();};
   try{source.start(now);source.stop(now+length);}catch(e){voices.delete(voice);source.disconnect();gain.disconnect();pan?.disconnect();throw e;}
   lastGroup.set(group,now);if(channel==='combat')bursts.web.push(now);return true;
  }catch{return false;}
 }
 function events(list){let count=0;for(const e of selectAudioEvents(list)){if(play(e.cue,e.x)&&++count>=2)break;}}
 function visibility(value){
  hidden=!!value;levels();
  if(hidden){stop();ctx?.suspend().catch(()=>{});}
  else if(ctx&&prefs.soundEnabled&&(prefs.combatVolume||prefs.interfaceVolume))unlock();
 }
 async function preview(){
  if(!enabled()||!prefs.interfaceVolume){status('Enable sound and raise interface volume first.');return false;}
  // Already-unlocked Web Audio can play immediately. Otherwise start native
  // playback directly in this click, then retain it as the fallback backend.
  if(backend==='web'&&ctx?.state==='running'&&buffers.has('confirm')){
   lastGroup.delete('ui');const ok=play('confirm');status(ok?'Preview playing · Web Audio.':'Preview is busy. Tap again.');return ok;
  }
  status('Starting audio preview…');
  const direct=nativePlay('confirm',{preview:true});
  if(direct){backend='media';ctx?.suspend().catch(()=>{});return true;}
  if(await unlock()){await loading;const ok=play('confirm');status(ok?'Preview playing · Web Audio.':'Audio unavailable: clips could not be loaded.');return ok;}
  status('Audio unavailable: browser did not unlock playback.');return false;
 }
 return {configure,unlock,play,events,visibility,stop,preview,get voiceCount(){return voices.size;}};
}
