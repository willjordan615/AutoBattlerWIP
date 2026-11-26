import test from 'node:test';
import assert from 'node:assert/strict';
import {ARENAS,spawn,makeChassis,stats,targetScoreDetails,positionScore} from '../src/simulation.js';
import {createMatch,draftPool,assign} from '../src/headless.js';
import {cardDetail,cardSummary} from '../src/module-info.js';

test('production opportunity is independent of remaining HP, respects access and defense, and preserves kill weighting',()=>{
 const b=spawn(['ranged','bruiser','rogue'].map(type=>({hp:100,squad:[makeChassis(type)]})),ARENAS[0],42);
 const [u,a,z]=b.units;
 Object.assign(u,{x:200,y:200});Object.assign(a,{x:250,y:200});Object.assign(z,{x:450,y:200});
 const before=targetScoreDetails(b,u,a).features;
 a.hp*=.1;
 const after=targetScoreDetails(b,u,a).features;
 assert.equal(before.damage,after.damage);assert.ok(after.kill>before.kill);
 assert.ok(before.damage>0&&before.damage<=.4);
 assert.equal(targetScoreDetails(b,u,z).features.damage,0);
 a.type='rogue';a.chassis=makeChassis('rogue');
 assert.ok(targetScoreDetails(b,u,a).features.damage>after.damage);
 b.arena={name:'wall',obstacles:[{x:220,y:180,w:5,h:40}]};
 assert.equal(targetScoreDetails(b,u,a).features.damage,0);
});
test('default position uses the measured position-only threat arm',()=>{
 const b=spawn(['ranged','bruiser'].map(type=>({hp:100,squad:[makeChassis(type)]})),ARENAS[0],43);
 const [u,e]=b.units;Object.assign(u,{x:200,y:200});Object.assign(e,{x:250,y:200,focus:u.id,intent:{x:0,y:0}});
 const point={x:195,y:200},s=stats(u),p=positionScore(b,u,e,point,s,[e]);
 b.aiExperiment='threat-position';assert.equal(positionScore(b,u,e,point,s,[e]),p);
});
test('hybrid target cards add only registered bonuses and stack without slots',()=>{
 const m=createMatch(['rogue','bruiser','ranged','bruiser'],2),u=m.players[0].squad[0];
 const before=stats({type:u.type,chassis:u}),w={...u.weights};
 for(const key of ['guardian','duelist','guardian','duelist','aggressor']){
  draftPool(m);m.draft.order=[0];m.draft.pool=[{kind:'target',key,name:'Targeting: '+key,uid:'fixture'}];m.draft.originalPool=m.draft.pool.slice();
  assign(m,0,'fixture',0);
 }
 const after=stats({type:u.type,chassis:u});
 assert.equal(after.hp-before.hp,10);assert.equal(after.speed-before.speed,9);
 assert.equal(after.damage,before.damage);
 assert.equal(u.weights.protection,w.protection+2);assert.equal(u.weights.isolation,w.isolation+2);
 assert.equal(u.weights.damage,w.damage+1);assert.equal(u.passives.length,0);assert.equal(u.modules.length,5);
 assert.match(cardSummary({kind:'target',key:'guardian'}),/\+5 base HP/);
 assert.match(cardDetail({kind:'target',key:'duelist'}),/4\.5 base movement speed/);
});
