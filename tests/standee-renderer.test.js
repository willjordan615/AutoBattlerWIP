import test from 'node:test';
import assert from 'node:assert/strict';
import {createStandeeRenderer,poseFor,STANDEE_SCALE} from '../src/standee-renderer.js';
import {STANDEE_PARTS,STANDEE_TYPES} from '../src/standee-art.js';
import {normalizeSettings} from '../src/performance-settings.js';
function harness(){
 const canvases=[],calls=[];
 const gradient={addColorStop(){}};
 const ctx=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient},{get:(target,k)=>target[k]??((...args)=>calls.push([k,...args]))});
 const renderer=createStandeeRenderer({makePath:d=>({d}),makeCanvas:(w,h)=>{const c={width:w,height:h,getContext:()=>ctx};canvases.push(c);return c;}});
 return {renderer,canvases,calls,ctx};
}
test('three distinct modular pieces cached once',()=>{
 const {renderer,canvases,ctx}=harness();assert.deepEqual(STANDEE_TYPES,['bruiser','rogue','ranged']);
 assert.ok(Object.values(STANDEE_PARTS).every(x=>x.length>=12));assert.equal(renderer.available(),true);assert.equal(canvases.length,3);
 const p=Object.freeze({id:1,type:'rogue',x:100,y:100,r:11,hp:10,maxHp:20,color:'#ffffff',facing:0,attackPhase:'windup'});
 for(let i=0;i<5;i++){assert.equal(renderer.piece(ctx,p,i),true);renderer.label(ctx,p);}
 assert.equal(canvases.length,3);
});
test('stage is cached and rebuilt only for changed geometry or raster scale',()=>{
 const {renderer,canvases,ctx}=harness(),arena=Object.freeze({obstacles:Object.freeze([Object.freeze({x:100,y:120,w:40,h:80})])});
 assert.equal(renderer.terrain(ctx,arena,true,.75),true);assert.equal(canvases.length,1);assert.equal(canvases[0].width,540);assert.equal(canvases[0].height,390);
 renderer.terrain(ctx,structuredClone(arena),true,.75);assert.equal(canvases.length,1);
 renderer.terrain(ctx,arena,true,1);assert.equal(canvases.length,2);
});
test('pose is deterministic and reduced motion retains only facing',()=>{
 const p={id:2,facing:Math.PI,moving:true,attackPhase:'windup'};
 assert.deepEqual(poseFor(p,2,false),{flip:-1,bob:0,lean:0});assert.deepEqual(poseFor(p,2),poseFor(p,2));assert.notEqual(poseFor(p,2).lean,0);
});
test('classic is a persistent choice and unsupported vector backend is harmless',()=>{
 assert.equal(normalizeSettings({theme:'classic'}).theme,'classic');assert.equal(normalizeSettings(null).theme,'standees');
 const r=createStandeeRenderer({makePath:null});assert.equal(r.available(),false);
});

test('larger art and foreground team rim keep the simulation radius untouched',()=>{
 const {renderer,calls,ctx}=harness();
 const p=Object.freeze({id:1,type:'rogue',x:100,y:100,r:11,hp:10,maxHp:20,color:'#64b3ff',facing:0});
 assert.equal(STANDEE_SCALE,4.05);renderer.piece(ctx,p,0,false);
 const draw=calls.find(c=>c[0]==='drawImage');assert.ok(Math.abs(draw[4]-11*4.05)<1e-9);
 const front=calls.filter(c=>c[0]==='ellipse').at(-1);assert.equal(front[3],12.5);assert.equal(p.r,11);
 assert.equal(ctx.strokeStyle,p.color);
});

test('health label has a strong team-colored fill and readable class rune',()=>{
 const {renderer,calls,ctx}=harness();const p=Object.freeze({x:100,y:100,r:11,type:'rogue',hp:5,maxHp:10,color:'#64b3ff'});
 renderer.label(ctx,p);const bars=calls.filter(c=>c[0]==='fillRect');assert.equal(bars.length,2);assert.equal(bars[1][3],15);assert.equal(bars[1][4],4);assert.equal(ctx.font,'bold 13px system-ui');assert.equal(calls.find(c=>c[0]==='fillText')[1],'R');
});
