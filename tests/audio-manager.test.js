import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CUES,MAX_VOICES,selectAudioEvents,classifyAudioEvent,createAudioManager} from '../src/audio-manager.js';
import {normalizeSettings} from '../src/performance-settings.js';
test('audio defaults quiet and saved preferences validate',()=>{const p=normalizeSettings(null);assert.equal(p.combatVolume,30);assert.equal(p.interfaceVolume,25);assert.equal(normalizeSettings({soundEnabled:false,combatVolume:300}).combatVolume,100);assert.equal(normalizeSettings({soundEnabled:false}).soundEnabled,false);});
test('cue files bundled; no routine DOT or wall noise; priority coalesces attacks',()=>{for(const name of Object.keys(CUES))assert.equal(readFileSync(new URL('../assets/audio/'+name+'.ogg',import.meta.url)).subarray(0,4).toString(),'OggS');assert.equal(classifyAudioEvent({kind:'dotDamage'}),null);assert.equal(classifyAudioEvent({kind:'wallImpact'}),null);assert.deepEqual(selectAudioEvents([{kind:'attackCommit',type:'rogue'},{kind:'attackCommit',type:'bruiser'},{kind:'reaction',ability:'bulwark'}]).map(x=>x.cue),['guard','light']);assert.equal(MAX_VOICES,4);});
test('unsupported audio is harmless',async()=>{const a=createAudioManager({createContext:()=>null});assert.equal(await a.unlock(),false);assert.equal(a.play('click'),false);a.visibility(true);assert.equal(a.voiceCount,0);});
test('quiet mixer limits voices, suppresses repeats and background audio',async()=>{
 const param=()=>({value:0,setTargetAtTime(){},setValueAtTime(){},linearRampToValueAtTime(){}});
 const ctx={state:'suspended',currentTime:0,destination:{},async resume(){this.state='running'},async suspend(){this.state='suspended'},createGain(){return {gain:param(),connect(){},disconnect(){}}},createBufferSource(){return {playbackRate:param(),connect(){},disconnect(){},start(){},stop(){}}},async decodeAudioData(){return {duration:.2}}};
 const a=createAudioManager({createContext:()=>ctx,fetchAsset:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}),random:()=>.5});
 assert.equal(await a.preview(),true);assert.equal(a.play('click'),false);ctx.currentTime=1;assert.equal(a.play('heavy'),true);assert.equal(a.play('light'),false);ctx.currentTime=2;assert.equal(a.play('utility'),true);ctx.currentTime=3;a.play('guard');ctx.currentTime=4;a.play('finish');assert.ok(a.voiceCount<=MAX_VOICES);a.visibility(true);assert.equal(a.voiceCount,0);assert.equal(a.play('heavy'),false);
});
