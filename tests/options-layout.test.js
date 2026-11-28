import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('all existing settings reside in Options and resume remains a launch action',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const panel=html.match(/<section id="settingsPanel"[^>]*>([\s\S]*?)<\/section>/)[1];
 for(const id of ['graphicsPreset','reducedMotion','keepAwake','accountPanel','createAccount','signInAccount','signOutAccount','deleteAccount','musicEnabled','musicVolume','soloHistoryConsent','quickHistoryConsent','playtestConsent','discardSolo']){assert.ok(panel.includes('id="'+id+'"'),id);assert.equal(html.split('id="'+id+'"').length,2,id);}
 assert.ok(!panel.includes('id="resumeSolo"'));assert.match(html,/<div id="soloResume"><button id="resumeSolo"/);
 const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');assert.ok(!css.includes('.layout[data-phase=mode] #playtestOptIn'));assert.ok(!css.includes('.layout[data-phase=mode] #historyPanel'));
});
