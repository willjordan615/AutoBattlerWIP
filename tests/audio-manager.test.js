import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CUES,MAX_VOICES,cueVariation,selectAudioEvents,classifyAudioEvent,createAudioManager} from '../src/audio-manager.js';
import {normalizeSettings} from '../src/performance-settings.js';
test('audio defaults quiet and saved preferences validate',()=>{const p=normalizeSettings(null);assert.equal(p.combatVolume,30);assert.equal(p.interfaceVolume,25);assert.equal(normalizeSettings({soundEnabled:false,combatVolume:300}).combatVolume,100);assert.equal(normalizeSettings({soundEnabled:false}).soundEnabled,false);});
test('cue files bundled; no routine DOT or wall noise; priority coalesces attacks',()=>{for(const name of Object.keys(CUES))assert.equal(readFileSync(new URL('../assets/audio/'+name+'.wav',import.meta.url)).subarray(0,4).toString(),'RIFF');assert.equal(classifyAudioEvent({kind:'dotDamage'}),null);assert.equal(classifyAudioEvent({kind:'wallImpact'}),null);assert.deepEqual(selectAudioEvents([{kind:'attackRelease',type:'rogue'},{kind:'attackRelease',type:'bruiser'},{kind:'reaction',ability:'bulwark'}]).map(x=>x.cue),['guard','light']);assert.equal(MAX_VOICES,6);});
test('unsupported audio is harmless',async()=>{const a=createAudioManager({createContext:()=>null});await a.unlock();assert.equal(a.play('click'),false);a.visibility(true);assert.equal(a.voiceCount,0);});
test('quiet mixer limits voices, suppresses repeats and background audio',async()=>{
 const param=()=>({value:0,setTargetAtTime(){},setValueAtTime(){},linearRampToValueAtTime(){}});
 const ctx={state:'suspended',currentTime:0,destination:{},async resume(){this.state='running'},async suspend(){this.state='suspended'},createGain(){return {gain:param(),connect(){},disconnect(){}}},createBufferSource(){return {playbackRate:param(),connect(){},disconnect(){},start(){},stop(){}}},async decodeAudioData(){return {duration:.2}}};
 const a=createAudioManager({createContext:()=>ctx,fetchAsset:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}),random:()=>.5});
 await a.unlock();await new Promise(resolve=>setImmediate(resolve));assert.equal(await a.preview(),true);assert.equal(a.play('click'),false);ctx.currentTime=1;assert.equal(a.play('heavy'),true);assert.equal(a.play('light'),false);assert.equal(a.play('impact'),true);assert.equal(a.play('guard'),true);assert.equal(a.play('utility'),false);ctx.currentTime=2;assert.equal(a.play('utility'),true);ctx.currentTime=3;a.play('guard');ctx.currentTime=4;a.play('finish');assert.ok(a.voiceCount<=MAX_VOICES);a.visibility(true);assert.equal(a.voiceCount,0);assert.equal(a.play('heavy'),false);
});

test('preview uses native media synchronously when Web Audio is not ready',async()=>{
 let played=0,paused=0;const status=[];
 const element={currentTime:0,volume:0,playbackRate:1,play(){played++;return Promise.resolve();},pause(){paused++;}};
 const a=createAudioManager({createContext:()=>null,makeMedia:()=>element,onStatus:m=>status.push(m)});
 const result=a.preview();assert.equal(played,1);assert.equal(await result,true);assert.ok(element.volume>0&&element.volume<.3);
 a.visibility(true);assert.ok(paused>0);assert.equal(a.voiceCount,0);
});
test('resume is attempted again on later activation even if earlier resume hangs',async()=>{
 let attempts=0;const param=()=>({value:0,setTargetAtTime(){}});
 const ctx={state:'suspended',currentTime:0,destination:{},createGain(){return {gain:param(),connect(){}}},resume(){attempts++;if(attempts===1)return new Promise(()=>{});this.state='running';return Promise.resolve();}};
 const a=createAudioManager({createContext:()=>ctx,fetchAsset:async()=>({ok:false})});
 const first=a.unlock();assert.equal(await a.unlock(),true);assert.equal(attempts,2);await first;
});

test('Hazardous ranged release selects one distinct sound without extra voice',()=>{
 const e={kind:'attackRelease',type:'ranged',modifiers:{hazardous:true}};
 assert.equal(classifyAudioEvent(e),'hazard');
 assert.equal(classifyAudioEvent({...e,modifiers:{hazardous:false}}),'pluck');
 assert.equal(classifyAudioEvent({...e,kind:'attackCommit'}),null);
 assert.deepEqual(selectAudioEvents([{kind:'attackRelease',type:'ranged'},e]).map(x=>x.cue),['hazard']);
});

test('per-cue cosmetic variation is bounded and keeps UI stable',()=>{
 for(const name of Object.keys(CUES)){
  const lo=cueVariation(name,()=>0),hi=cueVariation(name,()=>1);
  assert.ok(lo.rate>=.88&&hi.rate<=1.12);assert.ok(lo.gain>=.82&&hi.gain===1);
  assert.ok(lo.rate<hi.rate&&lo.gain<hi.gain);
 }
 assert.equal(cueVariation('heavy',()=>0).rate,.9);
 assert.equal(cueVariation('light',()=>0).rate,.88);
 assert.equal(cueVariation('confirm',()=>0).rate,.98);
});
test('native fallback changes pitch and gain on successive previews',async()=>{
 const values=[];let n=0;
 const el={preservesPitch:true,currentTime:0,volume:0,playbackRate:1,play(){values.push([this.playbackRate,this.volume,this.preservesPitch]);return Promise.resolve();},pause(){}};
 const a=createAudioManager({createContext:()=>null,makeMedia:()=>el,random:()=>n++<2?0:1});
 await a.preview('heavy');await a.preview('heavy');
 assert.equal(values.length,2);assert.ok(values[0][0]<values[1][0]);assert.ok(values[0][1]<values[1][1]);assert.equal(values[0][2],false);a.stop();
});
