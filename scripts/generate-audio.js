// Original offline procedural game audio. Run: node scripts/generate-audio.js
// Short shaped noise and damped resonances, no external samples or engine RNG.
import {mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export const CUE_NAMES=Object.freeze(["heavy","light","pluck","hazard","miss","impact","guard","utility","click","confirm","start","finish"]);
export function renderCue(name){
 const sampleRate=22050,durations={heavy:.28,light:.21,pluck:.17,hazard:.34,miss:.15,impact:.19,guard:.22,utility:.19,click:.035,confirm:.052,start:.16,finish:.23};
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
   case "heavy":v=(2.1*bass+.65*air+.32*grain)*env(t,.001,.048)+.28*mode(t,117,.034)+.12*mode(t,193,.023)+(.95*air+.55*grain)*env(t-.014,.001,.021)+(.5*air+.25*grain)*env(t-.039,.002,.032);break;
   case "light":v=(1.3*air+.65*grain+.12*edge)*bump(t,.066,.036)+(.65*bass+.30*air)*env(t,.012,.055);break;
   case "pluck":v=(.85*grain+.35*edge+.35*air)*env(t,.0008,.012)+.18*mode(t,231,.024)+.11*mode(t,463,.017)+.09*mode(t,691,.009)+.5*air*env(t-.012,.004,.03);break;
   case "hazard":v=(.7*bass+.6*air)*env(t,.001,.033)+(.8*air+.36*grain)*env(t,.013,.095)+.22*mode(t,152,.033)+.28*grain*bump(t,.09,.031);break;
   case "miss":v=(.8*air+.18*grain)*bump(t,.047,.025)+.25*bass*env(t,.01,.035);break;
   case "impact":v=(1.8*bass+.82*air+.24*grain)*env(t,.001,.032)+.15*mode(t,141,.022)+.26*grain*env(t-.019,.001,.018);break;
   case "guard":v=(.95*grain+.42*edge)*env(t,.001,.014)+.22*mode(t,819,.041)+.18*mode(t,1271,.025)+.11*mode(t,1937,.014)+.11*mode(t,2387,.009)+.4*bass*env(t,.002,.02);break;
   case "utility":v=(.75*air+.28*grain+.3*bass)*env(t,.013,.049)+.21*grain*bump(t,.056,.023);break;
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
