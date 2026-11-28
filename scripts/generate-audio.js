// Original offline procedural game audio. Run: node scripts/generate-audio.js
// Deterministic noise and damped resonances; no external samples or engine RNG.
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const CUE_NAMES=Object.freeze(["heavy","light","pluck","hazard","impact","guard","utility","click","confirm","start","finish"]);
export function renderCue(name){
 const sampleRate=22050, durations={heavy:.32,light:.25,pluck:.22,hazard:.39,impact:.22,guard:.31,utility:.23,click:.09,confirm:.16,start:.48,finish:.62};
 if(!Object.hasOwn(durations,name))throw Error("Unknown cue "+name);
 const n=Math.ceil(sampleRate*durations[name]),data=new Float64Array(n),tau=2*Math.PI;
 let seed=0x7a3b9c12;for(const c of name)seed=(Math.imul(seed,31)+c.charCodeAt(0))|0;
 const noise=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/2147483648-1;};
 let lo=0,mid=0,hi=0;
 const modal=(t,parts)=>t<0?0:parts.reduce((s,[freq,amp,decay])=>s+amp*Math.sin(tau*freq*t)*Math.exp(-t/decay),0);
 const env=(t,a,d)=>t<0?0:(1-Math.exp(-t/a))*Math.exp(-t/d);
 let peak=0;
 for(let i=0;i<n;i++){
  const t=i/sampleRate,w=noise();lo+=.065*(w-lo);mid+=.27*(w-mid);hi+=.65*(w-hi);
  const air=mid-lo,grain=hi-mid;
  const thump=(time)=>modal(time,[[91,.45,.045],[157,.16,.035],[231,.09,.019]]);
  const wood=(time)=>modal(time,[[270,.32,.025],[481,.23,.018],[721,.13,.012],[1127,.08,.008]]);
  const string=(time)=>modal(time,[[183,.39,.045],[369,.19,.031],[554,.095,.022],[742,.075,.014],[1117,.05,.011]]);
  let v=0;
  switch(name){
   case "heavy":{
    // Dense, dry, low-frequency tabletop impact with a short granular tail.
    const body=.90*Math.sin(tau*(68*t+4.5*(1-Math.exp(-t/.034))))*Math.exp(-t/.045);
    const grit=(.65*lo+.80*air+.33*grain)*(env(t,.0015,.048)+.40*env(t-.022,.003,.025));
    v=body+modal(t,[[123,.32,.033],[203,.18,.023],[346,.10,.016]])+grit+.22*wood(t-.016);break;
   }
   case "light":{
    // Broad, smooth air sweep with a brighter center, no pitched metallic note.
    const sweep=Math.exp(-Math.pow((t-.065)/.038,2));
    v=(1.22*air+.48*grain)*sweep+(1.05*lo+.30*air)*env(t,.026,.069)+.26*grain*env(t-.041,.009,.038);break;
   }
   case "pluck":v=string(t)*.85+.38*air*env(t,.001,.023)+.16*thump(t);break;
   case "hazard":v=.48*string(t)+.58*thump(t)+.46*air*env(t,.018,.105)+.24*grain*env(t,.016,.09)+modal(t-.045,[[127,.18,.085],[219,.10,.065],[347,.055,.05]]);break;
   case "impact":v=.91*thump(t)+.64*lo*env(t,.002,.048)+.35*air*env(t,.002,.035);break;
   case "guard":v=modal(t,[[437,.27,.086],[681,.22,.064],[1019,.15,.04],[1493,.08,.022],[2187,.045,.016]])+.24*air*env(t,.001,.018)+.18*thump(t);break;
   case "utility":v=.91*air*env(t,.016,.06)+.24*lo*env(t,.022,.08)+.23*wood(t-.043);break;
   case "click":v=wood(t)+.26*air*env(t,.0008,.013);break;
   case "confirm":v=.86*wood(t)+.26*wood(t-.043)+.17*thump(t);break;
   case "start":v=modal(t,[[196,.31,.19],[298,.18,.14],[427,.085,.095],[632,.035,.055]])+.18*lo*env(t,.007,.037);break;
   case "finish":v=modal(t,[[196,.30,.18],[294,.14,.12],[443,.07,.08]])+modal(t-.12,[[247,.23,.19],[369,.11,.11],[558,.05,.08]]);break;
  }
  const fade=Math.min(1,t/.003,(n-1-i)/(sampleRate*.025));
  data[i]=Math.tanh(v)*Math.max(0,fade);peak=Math.max(peak,Math.abs(data[i]));
 }
 const out=new Uint8Array(44+n*2),d=new DataView(out.buffer);
 const ascii=(pos,s)=>{for(let j=0;j<s.length;j++)out[pos+j]=s.charCodeAt(j);};
 ascii(0,"RIFF");d.setUint32(4,out.length-8,true);ascii(8,"WAVE");ascii(12,"fmt ");d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,sampleRate,true);d.setUint32(28,sampleRate*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);ascii(36,"data");d.setUint32(40,n*2,true);
 const target=name==="start"||name==="finish"?.60:name==="light"||name==="utility"?.70:.82;
 for(let i=0;i<n;i++)d.setInt16(44+i*2,Math.round(data[i]*target/Math.max(.001,peak)*32767),true);
 return out;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const dest=new URL('../assets/audio/',import.meta.url);mkdirSync(dest,{recursive:true});
 for(const name of CUE_NAMES)writeFileSync(new URL(name+'.wav',dest),renderCue(name));
 console.log('Generated '+CUE_NAMES.length+' procedural cues.');
}
