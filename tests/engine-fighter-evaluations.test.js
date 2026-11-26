import test from 'node:test';
import assert from 'node:assert/strict';
import {ARENAS,makeChassis,spawn,stats,targetScoreDetails,positionScore,tick,STEP} from '../src/simulation.js';

function scene(arena=ARENAS[0]){
 const b=spawn(['ranged','bruiser','rogue'].map((type,i)=>({name:'P'+i,hp:100,squad:[makeChassis(type)]})),arena,19);
 const [u,a,z]=b.units;
 Object.assign(u,{x:200,y:200});Object.assign(a,{x:300,y:200});Object.assign(z,{x:420,y:200});
 return {b,u,a,z};
}
const features=(b,u,e)=>targetScoreDetails(b,u,e).features;
const zero=u=>{for(const key of Object.keys(u.chassis.weights))u.chassis.weights[key]=0;};
test('health awareness scales only safety and preserves player weight control',()=>{
 const {b,u,a}=scene();
 const before=features(b,u,a);b.aiExperiment='safety';
 assert.deepEqual(features(b,u,a),before);
 u.hp=u.maxHp*.25;
 const after=features(b,u,a);
 assert.deepEqual(after,{...before,safety:before.safety*1.75});
 zero(u);
 const st=stats(u),point={x:190,y:200};
 const experimental=positionScore(b,u,a,point,st,[a]);
 delete b.aiExperiment;
 assert.equal(positionScore(b,u,a,point,st,[a]),experimental);
});
test('engagement preference distinguishes accessible and occluded targets without forcing selection',()=>{
 const {b,u,a,z}=scene();
 const baseA=features(b,u,a),baseZ=features(b,u,z);
 b.aiExperiment='engagement';
 assert.ok(Math.abs(features(b,u,a).damage-baseA.damage-.65)<1e-10);
 assert.equal(features(b,u,z).damage,baseZ.damage);
 assert.deepEqual({...features(b,u,a),damage:baseA.damage},baseA);
 b.arena={name:'Fixture',obstacles:[{x:245,y:160,w:20,h:80}]};
 assert.equal(features(b,u,a).damage,baseA.damage);
 zero(u);
 assert.equal(targetScoreDetails(b,u,a).total,targetScoreDetails(b,u,z).total);
});
test('coherent threat is local and respects visibility; only threat feature changes',()=>{
 const {b,u,a,z}=scene();
 a.x=235;z.x=650;a.focus=u.id;z.focus=u.id;
 const base=features(b,u,a);b.aiExperiment='threat';
 const near=features(b,u,a),far=features(b,u,z);
 assert.ok(near.threat>far.threat);assert.equal(far.threat,0);
 assert.deepEqual({...near,threat:base.threat},base);
 b.arena={name:'Fixture',obstacles:[{x:215,y:180,w:5,h:40}]};
 assert.equal(features(b,u,a).threat,0);
 zero(u);u.chassis.weights.threat=1;
 const st=stats(u);
 const p={x:195,y:200};
 const exp=positionScore(b,u,a,p,st,[a]);
 delete b.aiExperiment;
 assert.ok(exp>positionScore(b,u,a,p,st,[a]));
});
test('default and explicit control are identical on a fixed seed',()=>{
 const a=scene().b,b=scene().b;b.aiExperiment='control';
 const snapshot=x=>JSON.stringify(x,(k,v)=>k==='aiExperiment'?undefined:v);
 for(let i=0;i<90;i++){
  assert.deepEqual(tick(a,STEP),tick(b,STEP));
  assert.equal(snapshot(a),snapshot(b));
 }
});
