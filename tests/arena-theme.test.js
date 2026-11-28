import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createArenaTheme,THEME_ASSETS} from '../src/arena-theme.js';
import {normalizeSettings} from '../src/performance-settings.js';
test('classic choice is persistent-compatible; default and invalid values select Scribble',()=>{
 assert.equal(normalizeSettings({theme:'classic'}).theme,'classic');assert.equal(normalizeSettings(null).theme,'scribble');
});
test('all theme PNGs are bundled and Classic works before or after asset load',()=>{
 const images=[];const theme=createArenaTheme({makeImage:()=>{const x={};images.push(x);return x;}});
 assert.equal(theme.active('scribble'),false);theme.load();
 assert.equal(images.length,3);for(const img of images)img.onload();
 assert.equal(theme.active('scribble'),true);assert.equal(theme.active('classic'),false);
 for(const name of Object.values(THEME_ASSETS)){const b=readFileSync(new URL('../assets/scribble/'+name,import.meta.url));assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');}
});
test('missing image keeps classic fallback',()=>{const images=[];const theme=createArenaTheme({makeImage:()=>{const x={};images.push(x);return x;}});theme.load();images[0].onerror();images[1].onload();images[2].onload();assert.equal(theme.active('scribble'),false);});
