import test from 'node:test';
import assert from 'node:assert/strict';
import {ARENAS,makeChassis,spawn,stats,targetScoreDetails,positionScore} from '../src/simulation.js';
import {encounterPressure} from '../src/engine/targeting.js?v=engine-350-r1';

function fixture(){
 const b=spawn(['ranged','bruiser','rogue'].map((type,i)=>({name:'P'+i,hp:100,squad:[makeChassis(type)]})),ARENAS[0],21);
 b.aiExperiment='control';
 const [u,a,z]=b.units;
 Object.assign(u,{x:200,y:200});
 Object.assign(a,{x:250,y:200,focus:u.id,intent:{x:0,y:0}});
 Object.assign(z,{x:450,y:200});
 return {b,u,a,z};
}
test('v2 threat is independent of nominal damage and bounded',()=>{
 const {b,u,a}=fixture(),s=stats(a);
 const x=encounterPressure(b,u,u,a,s);
 assert.ok(x>0&&x<=1);
 assert.equal(encounterPressure(b,u,u,a,{...s,damage:s.damage*10}),x);
 a.chassis.mods.damage+=8;
 b.aiExperiment='threat-v2';
 assert.equal(targetScoreDetails(b,u,a).features.threat,x);
});
test('current visibility and opponent reach determine immediate pressure',()=>{
 const {b,u,a}=fixture(),s=stats(a);
 a.x=u.x+s.range;
 assert.ok(encounterPressure(b,u,u,a,s)>0);
 a.x+=1;
 assert.equal(encounterPressure(b,u,u,a,s),0);
 a.x=250;
 b.arena={name:'Wall',obstacles:[{x:220,y:170,w:10,h:60}]};
 assert.equal(encounterPressure(b,u,u,a,s),0);
});
test('short forecast distinguishes approaching and departing opponents',()=>{
 const {b,u,a}=fixture(),s=stats(a);
 a.x=u.x+s.range+5;
 a.intent={x:-1,y:0};
 const approaching=encounterPressure(b,u,u,a,s);
 assert.ok(approaching>0&&approaching<.25);
 a.intent={x:1,y:0};
 assert.equal(encounterPressure(b,u,u,a,s),0);
 a.x=u.x+s.range-5;
 a.intent={x:-1,y:0};
 const closing=encounterPressure(b,u,u,a,s);
 a.intent={x:1,y:0};
 assert.ok(closing>encounterPressure(b,u,u,a,s));
 a.intent={x:0,y:0};
 const focused=encounterPressure(b,u,u,a,s);
 a.focus=999;
 assert.ok(focused>encounterPressure(b,u,u,a,s));
});
test('target and position ablations isolate their own consumer and respect zero weights',()=>{
 const {b,u,a,z}=fixture(),st=stats(u);
 const enemies=[a,z],point={x:195,y:200};
 const baseT=targetScoreDetails(b,u,a),baseP=positionScore(b,u,a,point,st,enemies);
 b.aiExperiment='threat-target';
 const t=targetScoreDetails(b,u,a);
 assert.deepEqual({...t.features,threat:baseT.features.threat},baseT.features);
 assert.equal(positionScore(b,u,a,point,st,enemies),baseP);
 b.aiExperiment='threat-position';
 assert.deepEqual(targetScoreDetails(b,u,a),baseT);
 const p=positionScore(b,u,a,point,st,enemies);
 b.aiExperiment='threat-v2';
 assert.equal(positionScore(b,u,a,point,st,enemies),p);
 assert.deepEqual(targetScoreDetails(b,u,a),t);
 u.chassis.weights.threat=0;
 const t0=targetScoreDetails(b,u,a).total,p0=positionScore(b,u,a,point,st,enemies);
 b.aiExperiment='control';
 assert.equal(targetScoreDetails(b,u,a).total,t0);
 assert.equal(positionScore(b,u,a,point,st,enemies),p0);
});
