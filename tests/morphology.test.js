import test from 'node:test';
import assert from 'node:assert/strict';
import {CHASSIS,ARENAS,makeChassis,stats,morphologyTier,radiusOf,attackWindup,ATTACK_TIMING,bound,spawn,resolveCollision} from '../src/simulation.js';
import {catalog,createMatch,draftPool,assign,canEquip} from '../src/headless.js';
import {cardDetail,cardSummary} from '../src/module-info.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const unit=(type,tier=0)=>{const chassis=makeChassis(type);chassis.mods[tier<0?'shrink':'growth']=Math.abs(tier);return {type,chassis,x:100,y:100,hp:100,maxHp:100};};
test('Morphology changes derived stats symmetrically by net size tier',()=>{
 for(const type of Object.keys(CHASSIS)){
  const base=stats(unit(type));
  for(const tier of [-3,-1,1,3]){
   const u=unit(type,tier),st=stats(u);
   near(st.radius,base.radius*(1+.12*tier));
   near(st.hp,base.hp*(1+.15*tier));
   near(st.damage,base.damage*(1+.10*tier));
   near(st.range,base.range*(1+(type==='ranged'?.06:.12)*tier));
   near(st.speed,base.speed*(1-.10*tier));
   near(st.rate,base.rate/(1-.10*tier));
   near(attackWindup(u),ATTACK_TIMING[type].windup*(1+.10*tier));
  }
 }
});
test('Growth and Shrink are draftable, cancel, cap and preserve utility slots',()=>{
 const m=createMatch(),u=m.players[0].squad[0];u.passives=['regen','haste'];
 const g=catalog.find(c=>c.kind==='morphology'&&c.key==='growth'),s=catalog.find(c=>c.kind==='morphology'&&c.key==='shrink');
 assert.ok(g&&s&&cardDetail(g)&&cardSummary(s));
 draftPool(m);m.draft.pool=[{...g,uid:'growth'}];assign(m,0,'growth');
 assert.equal(morphologyTier(u),1);assert.deepEqual(u.passives,['regen','haste']);
 u.mods.growth=3;assert.equal(canEquip(u,g),false);assert.equal(canEquip(u,s),true);
 u.mods.shrink=3;assert.equal(morphologyTier(u),0);assert.equal(canEquip(u,g),true);
 u.mods.growth=0;assert.equal(canEquip(u,s),false);
});
test('Morphology radius controls boundaries, unit contact and starting HP',()=>{
 const a=unit('bruiser',3),b=unit('rogue',-3);a.id=1;b.id=2;a.x=0;a.y=100;
 bound(a,ARENAS[0]);near(a.x,20+radiusOf(a)+3);
 a.x=200;b.x=210;b.y=a.y;resolveCollision({units:[a,b],arena:ARENAS[0],time:0});
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=radiusOf(a)+radiusOf(b)+5-1e-6);
 const m=createMatch();m.players[0].squad[0].mods.growth=2;
 const state=spawn(m.players,ARENAS[0],1),live=state.units.find(x=>x.owner===0);
 near(live.hp,CHASSIS[live.type].hp*1.30);near(live.hp,live.maxHp);
});
