import test from 'node:test';
import assert from 'node:assert/strict';
import {AFTERIMAGE_DURATION,isUtilityAfterimage,drawUtilityAfterimage} from '../src/mobility-visual.js';

const colors=['#64b3ff','#f58086'];
const chassis={bruiser:{radius:15,fill:'#eeb878'},rogue:{radius:11,fill:'#c2a1fa'},ranged:{radius:11,fill:'#8ce7bd'}};
function mockCanvas(){
 const ops=[];
 const ctx={save:()=>ops.push('save'),restore:()=>ops.push('restore'),
  beginPath:()=>ops.push('beginPath'),
  moveTo:(...args)=>ops.push(['moveTo',...args]),
  lineTo:(...args)=>ops.push(['lineTo',...args]),
  stroke:()=>ops.push('stroke'),fill:()=>ops.push('fill'),
  arc:(...args)=>ops.push(['arc',...args]),
  fillText:(...args)=>ops.push(['fillText',...args])};
 for(const prop of ['globalAlpha','strokeStyle','fillStyle','lineWidth','font','textAlign']){
  Object.defineProperty(ctx,prop,{set:v=>ops.push([prop,v]),get:()=>undefined});
 }
 return {ctx,ops};
}
test('only discrete movement utility events create afterimages',()=>{
 for(const ability of ['dash','dodge','backstep','flank','intercept'])
  assert.ok(isUtilityAfterimage({kind:'mobility',ability}),ability);
 assert.equal(isUtilityAfterimage({kind:'mobility',ability:'followthrough'}),false);
 assert.equal(isUtilityAfterimage({kind:'damage',ability:'dash'}),false);
 assert.ok(AFTERIMAGE_DURATION>=.2&&AFTERIMAGE_DURATION<=.35,'fade is short on low-end Android');
});
test('utility afterimage draws a faded chassis token at the original position',()=>{
 const event={kind:'mobility',ability:'dash',type:'bruiser',owner:0,x:105,y:210,toX:155,toY:240};
 const {ctx,ops}=mockCanvas();
 assert.equal(drawUtilityAfterimage(ctx,event,0,colors,chassis),true);
 assert.ok(ops.some(o=>Array.isArray(o)&&o[0]==='arc'&&o[1]===105&&o[2]===210&&o[3]===19));
 assert.ok(ops.some(o=>Array.isArray(o)&&o[0]==='fillText'&&o[1]==='B'&&o[2]===105));
 assert.ok(ops.some(o=>Array.isArray(o)&&o[0]==='lineTo'&&o[1]===155&&o[2]===240));
 assert.equal(ops.filter(o=>o==='save').length,1);
 assert.equal(ops.filter(o=>o==='restore').length,1);
});
test('afterimage fades and never renders Follow Through, ordinary movement or expired effects',()=>{
 const base={kind:'mobility',ability:'dodge',type:'rogue',owner:1,x:80,y:130,toX:120,toY:145};
 const start=mockCanvas(),mid=mockCanvas(),end=mockCanvas();
 drawUtilityAfterimage(start.ctx,base,0,colors,chassis);
 drawUtilityAfterimage(mid.ctx,base,.5,colors,chassis);
 const alpha=x=>x.ops.filter(o=>Array.isArray(o)&&o[0]==='globalAlpha').map(o=>o[1]);
 assert.ok(Math.max(...alpha(mid))<Math.max(...alpha(start)));
 assert.equal(drawUtilityAfterimage(end.ctx,base,1,colors,chassis),false);
 assert.equal(end.ops.length,0);
 assert.equal(drawUtilityAfterimage(end.ctx,{...base,ability:'followthrough'},0,colors,chassis),false);
 assert.equal(drawUtilityAfterimage(end.ctx,{...base,type:'unknown'},0,colors,chassis),false);
 assert.equal(end.ops.length,0);
});
