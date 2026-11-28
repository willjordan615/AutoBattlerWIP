// Original offline procedural game audio. Run: node scripts/generate-audio.js
// Short shaped noise and damped resonances, no external samples or engine RNG.
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const CUE_NAMES=Object.freeze(["click","confirm","start","finish"]);
export function renderCue(name){
 const sampleRate=22050,durations={click:.035,confirm:.052,start:.16,finish:.23};
 if(!Object.hasOwn(durations,name))throw Error("Unknown cue "+name);
 const n=Math.ceil(sampleRate*durations[name]),data=new Float64Array(n),tau=2*Math.PI;
 let seed=0x7a3b9c12;for(const c of name)seed=(Math.imul(seed,31)+c.charCodeAt(0))|0;
 const noise=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/2147483648-1;};
 let lo=0,mid=0,hi=0,slow=0,peak=0;
 const env=(t,a,d)=>t<0?0:(1-Math.exp(-t/a))*Math.exp(-t/d);
 const mode=(t,f,d)=>t<0?0:Math.sin(tau*f*t)*Math.exp(-t/d);
 const bump=(t,c,w)=>Math.exp(-Math.pow((t-c)/w,2));
 for(let i=0;i<n;i++){
  const t=i/sampleRate,w=noise();slow+=.025*(w-slow);lo+=.09*(w-lo);mid+=.28*(w-mid);hi+=.72*(w-hi);
  const air=mid-lo,grain=hi-mid,bass=lo-slow,edge=w-hi;
  const tap=(s)=>env(s,.0007,.007)*(1.25*grain+.35*edge)+.09*mode(s,1847,.005)+.065*mode(s,2719,.003);
  let v=0;
  switch(name){
   case "click":v=tap(t);break;
   case "confirm":v=.85*tap(t)+.17*tap(t-.012);break;
   case "start":v=.45*tap(t)+(.75*air+.2*bass)*env(t,.01,.035)+.10*mode(t,523,.042);break;
   case "finish":v=(.7*air+.3*bass)*env(t,.012,.044)+.12*mode(t,392,.056)+.35*tap(t-.043);break;
  }
  const fade=Math.min(1,t/.0015,(n-1-i)/(sampleRate*Math.min(.02,durations[name]*.25)));
  data[i]=Math.tanh(v)*Math.max(0,fade);peak=Math.max(peak,Math.abs(data[i]));
 }
 const out=new Uint8Array(44+n*2),d=new DataView(out.buffer);
 const ascii=(pos,s)=>{for(let j=0;j<s.length;j++)out[pos+j]=s.charCodeAt(j);};
 ascii(0,"RIFF");d.setUint32(4,out.length-8,true);ascii(8,"WAVE");ascii(12,"fmt ");d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,sampleRate,true);d.setUint32(28,sampleRate*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);ascii(36,"data");d.setUint32(40,n*2,true);
 const target=name==="click"||name==="confirm"?.40:name==="start"||name==="finish"?.45:name==="light"||name==="utility"?.65:.82;
 for(let i=0;i<n;i++)d.setInt16(44+i*2,Math.round(data[i]*target/Math.max(.001,peak)*32767),true);
 return out;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const dest=new URL('../assets/audio/',import.meta.url);mkdirSync(dest,{recursive:true});
 for(const name of CUE_NAMES)writeFileSync(new URL(name+'.wav',dest),renderCue(name));
 console.log('Generated '+CUE_NAMES.length+' procedural cues.');
}
