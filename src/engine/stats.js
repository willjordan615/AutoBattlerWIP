// Engine subsystem: stats. See AGENTS.md for ownership and test routes.
import {CHASSIS,METRICS,BASE_WEIGHTS,morphologyTier,radiusOf} from './config.js?v=engine-350-r1';

export function rng(seed=12345){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
export function makeChassis(type){if(!CHASSIS[type])throw Error('Unknown chassis');return {type,mods:{coordinated:0,growth:0,shrink:0,hp:0,damage:0,speed:0,rate:0,range:0,projectiles:0,piercing:0,area:0,knockback:0,taunt:0,dash:0,dodge:0,backstep:0,flank:0,disengage:0,intercept:0,followthrough:0,range:0,sunder:0,precision:0,expose:0,disruption:0,momentum:0,chain:0,burning:0,hazardous:0,restless:0,velocity:0,rally:0,resonance:0,fortify:0,siphon:0,steadfast:0,patience:0,resolve:0,ricochet:0},weights:Object.fromEntries(METRICS.map((m,i)=>[m,BASE_WEIGHTS[type][i]||0])),passives:[],modules:[]}}
export function squadStatMultiplier(size=1){return Math.max(.7,1-.15*Math.max(0,Math.min(3,size)-1))}
export function resolveResistance(u){return (u.chassis.mods.resolve||0)>0?.8:0}
export function coordinationStacks(u){return Number((u.chassis.mods.coordinated||0)>0&&(u.livingAllies??Math.max(0,(u.squadSize??1)-1))>0&&(u.hp??1)>0);}
// Synchronize at tick boundaries and immediately after simultaneous damage.
// Preserve the health fraction: removing the bonus cannot itself eliminate a fighter.
export function syncLivingAllies(state){
 const counts=[];
 for(const u of state.units)if(u.hp>0)counts[u.owner]=(counts[u.owner]||0)+1;
 for(const u of state.units){
  const before=coordinationStacks(u);
  u.livingAllies=Math.max(0,(counts[u.owner]||0)-Number(u.hp>0));
  if(u.hp>0&&before!==coordinationStacks(u)){
   const ratio=u.hp/u.maxHp;
   u.maxHp=stats(u).hp;
   u.hp=Math.min(u.maxHp,ratio*u.maxHp);
  }
 }
}
export const DEFENSE_CAP=10;
export function defenseOf(u,omit=null){const c=CHASSIS[u.type],m=u.chassis.mods;return Math.min(DEFENSE_CAP,c.defense+(omit==='resolve'?0:(m.resolve||0)>0?2:0)+(omit!=='bulwark'&&u.bulwarkUntil>u.stateTime?3:0)+(omit!=='fortify'&&u.fortifyUntil>u.stateTime?u.fortifyStrength||0:0)+(omit!=='anchor'&&u.anchorUntil>u.stateTime?4:0));}
export function stats(u){const c=CHASSIS[u.type],m=u.chassis.mods,mult=squadStatMultiplier(u.squadSize??1),tier=morphologyTier(u),coord=1+.10*coordinationStacks(u);return {hp:(c.hp*mult+m.hp*20)*(tier>0?1.30:tier<0?.85:1)*coord,damage:(c.damage*mult+m.damage*2)*(1+.10*tier)*coord,speed:(c.speed+m.speed*18)*(tier>0?.90:tier<0?1.15:1)*(u.hasteUntil>u.stateTime?1.4:1)*(u.rallyUntil>u.stateTime?1+(u.rallyStrength||0):1)*(u.effects?.slowUntil>u.stateTime?1-Math.min(.45,u.effects.slowStrength||0)*(1-resolveResistance(u)):1)*coord,range:(c.range+m.range*8)*(1+(u.type==='ranged'?.06:.12)*tier)*coord,rate:c.rate/(tier>0?.90:tier<0?1.15:1)/(1+m.rate*.15)/(u.focusUntil>u.stateTime?1.35:1)/coord,defense:defenseOf(u),radius:radiusOf(u),projectiles:1+m.projectiles,piercing:m.piercing,area:m.area,knockback:m.knockback,taunt:m.taunt||0,dash:m.dash||0,dodge:m.dodge||0,backstep:m.backstep||0,flank:m.flank||0,disengage:m.disengage||0,intercept:m.intercept||0,followthrough:m.followthrough||0,delivery:c.delivery}}
