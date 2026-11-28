import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSettings,renderProfile,arenaPoint,createFrameGate,createPerformanceAdvisor} from '../src/performance-settings.js';
test('presets validate, preserve logical geometry and honor reduced motion',()=>{
 assert.equal(normalizeSettings({preset:'__proto__'}).preset,'balanced');
 const saver=renderProfile({preset:'saver',reducedMotion:false});assert.equal(saver.fps,20);assert.equal(saver.scale,.75);assert.equal(saver.afterimages,false);
 assert.equal(renderProfile({preset:'high',reducedMotion:true}).damageNumbers,false);
 assert.deepEqual(arenaPoint({left:10,top:20,width:360,height:260},190,150),{x:360,y:260});
});
test('frame gating is independent of simulation and keeps target cadence',()=>{
 for(const fps of [20,30,60]){const g=createFrameGate();let n=0;for(let i=0;i<60;i++)if(g.due(i*1000/60,fps))n++;assert.ok(Math.abs(n-fps)<=1,String(n));g.reset();assert.equal(g.due(0,fps),true);}
});
test('advisor recommends only after sustained poor rendering',()=>{
 const a=createPerformanceAdvisor();let result;for(let i=0;i<119;i++)assert.equal(a.observe({elapsed:70,work:30,fps:30,preset:'balanced'}),null);
 result=a.observe({elapsed:70,work:30,fps:30,preset:'balanced'});assert.equal(result,'saver');a.reset();
 for(let i=0;i<240;i++)assert.equal(a.observe({elapsed:16.7,work:2,fps:30,preset:'balanced'}),null);
});
