import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CUE_NAMES,renderCue} from '../scripts/generate-audio.js';
import {CUES} from '../src/audio-manager.js';
test('procedural samples are bounded, mono PCM, non-silent, deterministic and bundled',()=>{
 assert.deepEqual(new Set(CUE_NAMES),new Set(Object.keys(CUES)));
 for(const name of CUE_NAMES){
  const a=renderCue(name),b=renderCue(name),d=new DataView(a.buffer);
  assert.deepEqual(a,b);assert.equal(d.getUint16(22,true),1);assert.equal(d.getUint32(24,true),22050);assert.equal(d.getUint16(34,true),16);
  assert.ok(a.length<30000);let max=0;for(let i=44;i<a.length;i+=2)max=Math.max(max,Math.abs(d.getInt16(i,true)));assert.ok(max>10000&&max<28000);
  assert.deepEqual(Buffer.from(a),readFileSync(new URL('../assets/audio/'+name+'.wav',import.meta.url)));
 }
 assert.notDeepEqual(renderCue('pluck'),renderCue('hazard'));
});
