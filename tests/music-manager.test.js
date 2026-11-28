import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMusicManager} from '../src/music-manager.js';
import {normalizeSettings} from '../src/performance-settings.js';
test('music asset and conservative preferences',()=>{
 assert.equal(readFileSync(new URL('../assets/audio/music.ogg',import.meta.url)).subarray(0,4).toString(),'OggS');
 assert.equal(normalizeSettings(null).musicVolume,6);
 assert.equal(normalizeSettings({musicEnabled:false,musicVolume:150}).musicEnabled,false);
 assert.equal(normalizeSettings({musicVolume:150}).musicVolume,100);
});
test('music loads on gesture, remains one element, pauses on hide and mute',async()=>{
 let made=0,plays=0;const el={paused:true,currentTime:18,play(){plays++;this.paused=false;return Promise.resolve();},pause(){this.paused=true;}};
 const m=createMusicManager({makeMedia:()=>{made++;return el;}});
 m.configure({musicVolume:12});assert.equal(made,0);
 await m.unlock();assert.equal(plays,1);assert.equal(el.loop,true);assert.equal(el.volume,.12);
 await m.unlock();assert.equal(plays,1);
 m.visibility(true);assert.equal(el.paused,true);
 m.visibility(false);assert.equal(el.paused,false);assert.equal(el.currentTime,18);
 m.configure({musicEnabled:false,musicVolume:12});assert.equal(el.paused,true);
 m.configure({musicEnabled:true,musicVolume:20});assert.equal(el.volume,.2);
 m.configure({soundEnabled:false,musicVolume:20});assert.equal(el.paused,true);assert.equal(made,1);
});
test('a rejected play can be retried by the next gesture',async()=>{
 let attempts=0;const el={paused:true,play(){attempts++;if(attempts===1)return Promise.reject(Error('blocked'));this.paused=false;return Promise.resolve();},pause(){this.paused=true;}};
 const m=createMusicManager({makeMedia:()=>el});
 assert.equal(await m.unlock(),false);assert.equal(await m.unlock(),true);assert.equal(attempts,2);
});
