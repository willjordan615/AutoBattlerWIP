import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('presentation stylesheet and original menu art are local and versioned',()=>{
 const version=JSON.parse(read('build.json')).version;
 assert.ok(read('index.html').includes('presentation.css?v='+version));
 assert.ok(read('src/version-check.js').includes(version));
 const css=read('presentation.css');
 assert.ok(css.includes('./assets/art/keep.svg'));
 assert.match(read('assets/art/keep.svg'),/<svg[^>]+viewBox=/);
 assert.ok(css.includes('aspect-ratio:720/520'));
 assert.ok(css.includes('prefers-reduced-motion:reduce'));
 for(const kind of ['attack','target','utility','passive','morphology','unit'])assert.ok(css.includes('data-kind="'+kind+'"'));
});
