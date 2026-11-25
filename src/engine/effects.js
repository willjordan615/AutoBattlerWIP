// Engine subsystem: effects. See AGENTS.md for ownership and test routes.
import {ATTACK_STAGES} from './module-registry.js?v=engine-320';
import {distance,clearLine} from './geometry.js?v=engine-320';
import {resolveResistance,stats} from './stats.js?v=engine-320';
import {CHASSIS} from './config.js?v=engine-320';
import {physicalLineClear} from './navigation.js?v=engine-320';
import {measure} from './telemetry.js?v=engine-320';

// Returns true for all targets struck by the SAME committed attack; other
// attacks respect the independent cooldown. Projectile volleys can arrive
// across multiple simulation ticks without multiplying the proc rate.
export function claimAttackEffect(source,key,attackId,now){
 const cooldown=ATTACK_STAGES[key]?.cooldown||0;
 if(!cooldown)return true;
 const active=source.effectActivations||(source.effectActivations={});
 const previous=active[key];
 if(previous&&attackId!=null&&previous.attackId===attackId)return true;
 if(previous&&now+1e-8<previous.until)return false;
 active[key]={attackId,until:now+cooldown};
 return true;
}


// Attack effects act on actual impacts, never on visual commitment events.
function traveledRecently(u,now){
 const path=u.motion||[];let total=0;
 for(let i=1;i<path.length;i++)if(path[i].time>=now-2)total+=distance(path[i-1],path[i]);
 return Math.min(100,total);
}
// Credit directly measurable damage without pretending the engine can isolate the
// counterfactual value of positioning, CC, attack range, target choice or mobility.
// Melee Ricochet uses the committed attack footprint, not the actor's later facing.
export function applyRicochetSlide(state,hit){
 const {source,target}=hit;
 const stacks=Math.min(4,source.chassis.mods.ricochet||0);
 if(!stacks||source.type==='ranged'||hit.projectile||hit.secondary||hit.indirect||hit.damage<=0||target.hp<=0)return false;
 const origin=hit.attackOrigin||source;
 const heading=hit.attackDirection??Math.atan2(target.y-origin.y,target.x-origin.x);
 const fx=Math.cos(heading),fy=Math.sin(heading),lx=-fy,ly=fx;
 const side=(target.x-origin.x)*lx+(target.y-origin.y)*ly;
 const sign=side< -1e-8?-1:1;
 const stability=target.steadfastUntil>state.time?1+(target.steadfastStrength||0):1;
 const lateral=16*stacks*(1-resolveResistance(target))/stability;
 const radial=(hit.knockback||0)*4/stability;
 const dx=lx*sign*lateral+fx*radial,dy=ly*sign*lateral+fy*radial;
 const before={x:target.x,y:target.y},r=CHASSIS[target.type].radius+3;
 const length=Math.hypot(dx,dy);
 const steps=Math.max(1,Math.ceil(length/2));
 let blocked=false;
 for(let i=1;i<=steps;i++){
  const point={x:before.x+dx*i/steps,y:before.y+dy*i/steps};
  if(point.x<20+r||point.x>700-r||point.y<20+r||point.y>500-r||!physicalLineClear(target,point,state.arena,r)){blocked=true;break;}
  if(state.units.some(other=>other!==target&&other.hp>0&&
   distance(point,other)<CHASSIS[target.type].radius+CHASSIS[other.type].radius+5&&
   distance(point,other)<distance(target,other)-1e-8)){blocked=true;break;}
  target.x=point.x;target.y=point.y;
 }
 const moved=distance(before,target);
 measure(state,source,'ricochet','meleeSlides');
 measure(state,source,'ricochet','slideDistance',moved);
 measure(state,source,'ricochet','nominalSlideDistance',length);
 if(blocked){
  measure(state,source,'ricochet','slideCollisions');
  if((target.ricochetImmuneUntil||0)<=state.time){
   target.ricochetStunUntil=state.time+1;
   target.ricochetImmuneUntil=state.time+5;
   target.attack=null;target.followthroughCommit=null;target.navigation=null;target.navProgress=null;
   target.moveDecision={x:0,y:0};target.intent={x:0,y:0};target.holdingPosition=false;
   measure(state,source,'ricochet','collisionStuns');
   measure(state,source,'ricochet','nominalStunSeconds',1);
   state.visualEvents.push({kind:'reaction',ability:'ricochet',owner:target.owner,x:target.x,y:target.y});
  }else measure(state,source,'ricochet','immuneCollisions');
 }
 if(radial&&stability>1)measure(state,target,'steadfast','nominalKnockbackAvoided',hit.knockback*4-radial);
 if(resolveResistance(target))measure(state,target,'resolve','nominalSlideDistanceAvoided',16*stacks*resolveResistance(target)/stability);
 if(moved>1e-8){
  target.navigation=null;target.navProgress=null;
  state.visualEvents.push({kind:'mobility',ability:'ricochet',owner:target.owner,type:target.type,x:before.x,y:before.y,toX:target.x,toY:target.y});
 }
 return true;
}
export function resolveAttackModules(state,attacks){
 const output=[];
 for(const hit of attacks){
  if(hit.secondary||hit.indirect){output.push(hit);continue}
  const source=hit.source,target=hit.target,mods=source.chassis.mods;
  const effects=target.effects||(target.effects={}),contributions={};
  const add=(key,damage)=>{if(damage>0)contributions[key]=(contributions[key]||0)+damage};
  const initialRaw=hit.rawDamage??hit.damage,baseDefense=stats(target).defense;
  let raw=initialRaw;
  // Track marginal post-defense improvements in a fixed, reproducible order.
  const gain=(key,extra)=>{
   if(!extra)return;
   const before=Math.max(1,raw-baseDefense);
   raw+=extra;
   add(key,Math.max(0,Math.max(1,raw-baseDefense)-before));
  };
  if(mods.resonance&&target.lastAllyHit?.owner===source.owner&&target.lastAllyHit.sourceId!==source.id&&state.time-target.lastAllyHit.time<=1.5)gain('resonance',Math.min(4,mods.resonance)*1.5);
  if(mods.precision&&target.hp/target.maxHp>.75)gain('precision',mods.precision*2);
  if(mods.momentum)gain('momentum',mods.momentum*2*traveledRecently(source,state.time)/100);
  if(source.retaliationReady>state.time){gain('retaliation',4);source.retaliationReady=0}
  if(effects.expose&&effects.expose.until>state.time&&
     effects.expose.owner===source.owner&&effects.expose.sourceId!==source.id){
   gain('expose',2*effects.expose.stacks);effects.expose=null;
  }
  const sunderStrength=effects.sunderUntil>state.time?Math.min(3,effects.sunder||0):0;
  const defense=Math.max(0,baseDefense-sunderStrength);
  add('sunder',Math.max(0,Math.max(1,raw-defense)-Math.max(1,raw-baseDefense)));
  hit.rawDamage=raw;hit.damage=Math.max(1,raw-defense);
  if(state.moduleTelemetry){if(target.chassis.mods.resolve){const withoutResolve=Math.max(0,baseDefense-target.chassis.mods.resolve-sunderStrength);measure(state,target,'resolve','nominalDamagePrevented',Math.max(0,Math.max(1,raw-withoutResolve)-hit.damage));}if(target.fortifyUntil>state.time)measure(state,target,'fortify','nominalDamagePrevented',Math.max(0,Math.max(1,raw-Math.max(0,defense-(target.fortifyStrength||0)))-hit.damage));if(target.anchorUntil>state.time)measure(state,target,'anchor','nominalDamagePrevented',Math.max(0,Math.max(1,raw-Math.max(0,defense-4))-hit.damage));}
  const chained=mods.chain?state.units.filter(u=>u!==target&&u.hp>0&&u.owner!==source.owner&&
   distance(u,target)<=95&&clearLine(target,u,state.arena)).sort((a,b)=>distance(a,target)-distance(b,target)||a.id-b.id)[0]:null;
  const split=mods.chain?Math.min(.6,.2*mods.chain):0;
  hit.chainRedirected=hit.damage*split;
  hit.damage*=1-split;
  hit.moduleDamage=Object.fromEntries(Object.entries(contributions).map(([key,value])=>[key,value*(1-split)]));
  output.push(hit);
  if(chained){
   const damage=Math.max(0,raw*split-stats(chained).defense);
   output.push({source,target:chained,rawDamage:raw*split,
    damage,secondary:true,moduleDamage:{chain:damage}});
   state.visualEvents.push({kind:'chain',x:target.x,y:target.y,toX:chained.x,toY:chained.y,owner:source.owner});
  }
  if(mods.sunder){effects.sunder=Math.min(3,mods.sunder);effects.sunderUntil=state.time+2}
  if(mods.expose)effects.expose={owner:source.owner,sourceId:source.id,stacks:Math.min(4,mods.expose),until:state.time+1.5};
  if(mods.disruption){
   effects.slowStrength=Math.min(.45,.08*mods.disruption);
   effects.slowUntil=state.time+.6;
  }
  if(mods.burning&&claimAttackEffect(source,'burning',hit.attackId,state.time))
   effects.burn={source,dps:Math.min(12,2*mods.burning),until:state.time+2};
  if(mods.hazardous&&claimAttackEffect(source,'hazardous',hit.attackId,state.time)){
   const own=state.zones.filter(z=>z.source.id===source.id);
   if(own.length>=2){
    const oldest=own.sort((a,b)=>a.until-b.until)[0];
    state.zones.splice(state.zones.indexOf(oldest),1);
   }
   state.zones.push({x:target.x,y:target.y,owner:source.owner,source,
    radius:18+Math.min(4,mods.hazardous)*3,dps:Math.min(10,2*mods.hazardous),until:state.time+2.5});
  }
  target.lastAllyHit={owner:source.owner,sourceId:source.id,time:state.time};
  if(mods.fortify){measure(state,source,'fortify','landedHits');source.fortifyUntil=state.time+1;source.fortifyStrength=Math.min(4,mods.fortify);}
  if(mods.steadfast){measure(state,source,'steadfast','landedHits');source.steadfastUntil=state.time+1;source.steadfastStrength=Math.min(1,mods.steadfast*.25);}
  source.lastAttacked=target.id;source.lastAttackAt=state.time;
 }
 if(state.zones.length>60)state.zones.splice(0,state.zones.length-60);
 return output;
}
export function environmentalAttacks(state,dt){
 const hits=[];
 for(const u of state.units){
  if(u.hp<=0)continue;
  const burn=u.effects?.burn;
  if(burn&&burn.until>state.time&&burn.source){
   hits.push({source:burn.source,target:u,rawDamage:burn.dps*dt,
    damage:burn.dps*dt,indirect:true,moduleDamage:{burning:burn.dps*dt}});
  }
 }
 state.zones=state.zones.filter(z=>z.until>state.time);
 for(const z of state.zones)for(const u of state.units){
  if(u.hp>0&&u.owner!==z.owner&&distance(u,z)<z.radius+CHASSIS[u.type].radius){
   if(z.slow){measure(state,z.source,'wake','enemyPatchSeconds',dt);u.effects||={};if(!(u.effects.slowUntil>state.time&&u.effects.slowStrength>.18)){u.effects.slowStrength=.18;u.effects.slowUntil=state.time+.15;}continue;}
   hits.push({source:z.source,target:u,rawDamage:z.dps*dt,damage:z.dps*dt,indirect:true,moduleDamage:{hazardous:z.dps*dt}});
  }
 }
 return hits;
}
