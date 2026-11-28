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

test('courtyard and portrait assets remain local, and the court is independently rendered',()=>{
 const css=read('presentation.css'),server=read('server/index.js');
 for(const asset of ['grain','bruiser','rogue','ranged']){assert.ok(css.includes('./assets/art/'+asset+'.svg'));assert.match(read('assets/art/'+asset+'.svg'),/<svg[^>]+viewBox=/);assert.ok(server.includes(asset));}
 assert.match(read('src/standee-renderer.js'),/paintCourtyard\(g,arena,grid\)/);
 assert.match(read('src/courtyard-art.js'),/rect\(20,20,680,480\)/);
 assert.ok(!read('src/courtyard-art.js').includes('Math.random'));
});

test('combat removes interface grain; detailed surfaces stay in menus',()=>{
 const css=read('presentation.css');assert.match(css,/\.layout\[data-phase=fight\] \.panel[^{}]+\{background-image:none;box-shadow:none\}/);assert.ok(css.includes('5.0.3: Put atmosphere in menus'));
});
