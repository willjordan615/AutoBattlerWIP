import test from 'node:test';
import assert from 'node:assert/strict';
import {ARENAS,makeChassis,spawn,stats,targetScoreDetails,positionScore} from '../src/simulation.js';

function scene(){
 const b=spawn(['ranged','bruiser','rogue'].map((type,i)=>({name:'P'+i,hp:100,squad:[makeChassis(type)]})),ARENAS[0],21);
 const [u,a,z]=b.units;
 Object.assign(u,{x:200,y:200});
 Object.assign(a,{x:235,y:200,focus:u.id,intent:{x:0,y:0}});
 Object.assign(z,{x:450,y:200});
 return {b,u,a,z};
}
test('combined arms reproduce their independent feature changes',()=>{
 const {b,u,a,z}=scene(),st=stats(u),point={x:195,y:200},enemies=[a,z];
 const baseline=targetScoreDetails(b,u,a),basePosition=positionScore(b,u,a,point,st,enemies);
 b.aiExperiment='threat-position';
 const revisedPosition=positionScore(b,u,a,point,st,enemies);
 for(const [suffix,bonus] of [['low',.20],['mid',.40],['high',.65]]){
  b.aiExperiment=suffix==='high'?'engagement':'engagement-'+suffix;
  const t=targetScoreDetails(b,u,a);
  assert.ok(Math.abs(t.features.damage-baseline.features.damage-bonus)<1e-10);
  assert.deepEqual({...t.features,damage:baseline.features.damage},baseline.features);
  assert.equal(positionScore(b,u,a,point,st,enemies),basePosition);
  b.aiExperiment='position-engagement-'+suffix;
  assert.deepEqual(targetScoreDetails(b,u,a),t);
  assert.equal(positionScore(b,u,a,point,st,enemies),revisedPosition);
 }
});
test('position safety pressure arm preserves targeting and responds only through safety weight relative to position-only',()=>{
 const {b,u,a,z}=scene(),st=stats(u),point={x:195,y:200},enemies=[a,z];
 const baseline=targetScoreDetails(b,u,a);
 b.aiExperiment='position-safety-pressure';
 assert.deepEqual(targetScoreDetails(b,u,a),baseline);
 const p=positionScore(b,u,a,point,st,enemies);
 b.aiExperiment='threat-position';
 assert.notEqual(positionScore(b,u,a,point,st,enemies),p);
 u.chassis.weights.safety=0;
 const zero=positionScore(b,u,a,point,st,enemies);
 b.aiExperiment='position-safety-pressure';
 assert.equal(positionScore(b,u,a,point,st,enemies),zero);
});
