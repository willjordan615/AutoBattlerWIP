// One local, looped background track. Independent of simulation and SFX voices.
export const MUSIC_URL=new URL('../assets/audio/music.ogg?v=2026-11-28-courtyard-502',import.meta.url).href;
export function createMusicManager({makeMedia=url=>typeof Audio==='function'?new Audio(url):null,onStatus=()=>{}}={}){
 let element=null,enabled=true,volume=6,hidden=false,activated=false,pending=null,generation=0;
 const status=s=>{try{onStatus(s);}catch{}};
 const wanted=()=>enabled&&volume>0&&!hidden&&activated;
 function pause(){generation++;pending=null;try{element?.pause();}catch{}}
 function resume(){
  if(!wanted())return Promise.resolve(false);
  try{
   if(!element){element=makeMedia(MUSIC_URL);if(!element){status('Music unavailable');return Promise.resolve(false);}element.preload='none';element.loop=true;}
   element.volume=volume/100;
   if(pending)return pending;
   if(element.paused===false)return Promise.resolve(true);
   const token=generation;
   const result=element.play(); // must run directly in trusted gesture
   pending=Promise.resolve(result).then(()=>{
    if(token!==generation){if(!wanted())element.pause();return false;}
    pending=null;
    if(!wanted()){element.pause();return false;}
    status('Playing · The Old Tower Inn');return true;
   },()=>{
    if(token===generation){pending=null;status('Music unavailable · tap again to retry');}
    return false;
   });
   return pending;
  }catch{pending=null;status('Music unavailable');return Promise.resolve(false);}
 }
 function configure(p){
  enabled=p.soundEnabled!==false&&p.musicEnabled!==false;
  volume=Number.isFinite(p.musicVolume)?Math.min(100,Math.max(0,p.musicVolume)):6;
  if(element)element.volume=volume/100;
  if(!wanted()){pause();if(!enabled||!volume)status('Music off');}
  else resume();
 }
 function unlock(){activated=true;return resume();}
 function visibility(value){hidden=!!value;if(hidden)pause();else resume();}
 return {configure,unlock,visibility};
}
