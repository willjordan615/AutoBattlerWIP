import {CHASSIS} from './simulation.js?v=module-expansion-310';
import {legal,canEquip,TARGET_MODULES,COOPERATIVE_KEYS} from './headless.js?v=module-expansion-310';

// A seeded, persistent tactical inclination, not a preselected build.
export const TRAITS=['mobility','control','survival','focusFire','teamwork','coverage'];
const TRAITS_BY_CARD={
 'attack:projectiles':{coverage:1,control:.3},'attack:piercing':{coverage:.9},
 'attack:area':{coverage:.85,control:.35},'attack:knockback':{survival:.65,control:.8},
 'attack:taunt':{teamwork:.8,control:.5},'attack:range':{survival:.5,coverage:.2},
 'attack:sunder':{teamwork:.65,focusFire:.65},'attack:precision':{focusFire:1},
 'attack:expose':{teamwork:1,focusFire:.5},'attack:disruption':{control:1,survival:.2},
 'attack:momentum':{mobility:1},'attack:chain':{coverage:1,control:.3},
 'attack:burning':{mobility:.6,control:.25},'attack:hazardous':{control:1,coverage:.4},
 'attack:restless':{mobility:.55,coverage:.5},
 'utility:dash':{mobility:1},'utility:dodge':{survival:1,mobility:.5},
 'utility:backstep':{survival:.8,mobility:.65},'utility:flank':{mobility:1,coverage:.25},
 'attack:disengage':{survival:1,mobility:.7},'utility:intercept':{teamwork:1,mobility:.5},
 'attack:followthrough':{mobility:1,coverage:.3},
 'passive:regen':{survival:1},'passive:bulwark':{survival:1,teamwork:.2},
 'passive:haste':{mobility:1},'passive:focus':{focusFire:1},
 'passive:retaliation':{survival:.5,focusFire:.65},
 'target:executioner':{focusFire:1},'target:guardian':{teamwork:1},
 'target:skirmisher':{survival:.5,mobility:.3},'target:coward':{survival:1},
 'target:duelist':{mobility:.5,focusFire:.5},'target:hunter':{focusFire:.5},
 'target:aggressor':{focusFire:1}
};
const BASE={
 attack:{projectiles:23,piercing:21,area:21,knockback:18,taunt:21,range:22,
  sunder:22,precision:21,expose:21,disruption:23,momentum:21,chain:22,
  burning:22,hazardous:22,restless:20,followthrough:22,disengage:22},
 utility:{dash:22,dodge:24,backstep:21,flank:22,intercept:21},
 passive:{regen:23,bulwark:24,haste:23,focus:23,retaliation:21},
 target:{executioner:22,guardian:21,skirmisher:21,coward:20,duelist:21,hunter:20,aggressor:21}
};
const TARGET_KEYS={executioner:'kill',guardian:'protection',skirmisher:'preferredRange',
 coward:'safety',duelist:'isolation',hunter:'distance',aggressor:'damage'};
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const add=(pieces,label,value)=>{
 if(Math.abs(value)>1e-7)pieces.push({reason:label,points:Number(value.toFixed(2))});
};
// Stable hash intentionally does not advance the draft RNG or depend on pick order.
export function draftPersonality(seed,index){
 let x=(seed^Math.imul(index+1,0x9e3779b9))>>>0;
 const preferences={};
 for(const trait of TRAITS){
  x=(Math.imul(x^x>>>16,0x7feb352d)+0x6d2b79f5)>>>0;
  preferences[trait]=Number(((x/4294967296)*2-1).toFixed(3));
 }
 return preferences;
}
export function evaluateDraft(player,card,chassisIndex=0,passiveSlot=0,preferences={}){
 if(!legal(player,card)||card.kind!=='unit'&&!canEquip(player.squad[chassisIndex],card))
  return {score:-Infinity,parts:[],reasons:['Unavailable']};
 const parts=[];const unit=player.squad[chassisIndex],count=player.squad.length;
 if(card.kind==='unit'){
  const copies=player.squad.filter(x=>x.type===card.key).length;
  add(parts,'Another active fighter',count===1?29:count===2?22:0);
  add(parts,'Different chassis role',copies?0:3);
  add(parts,'Teamwork tendency',(preferences.teamwork||0)*1.8);
  add(parts,'Extra chassis base-stat penalty',count===1?-3:-5);
 }else{
  const type=unit.type,m=unit.mods,w=unit.weights,slots=unit.passives;
  const has=k=>slots.includes(k),stack=k=>m[k]||0;
  add(parts,'Base usefulness',BASE[card.kind]?.[card.key]??21);
  if(COOPERATIVE_KEYS.has(card.key))add(parts,'Available allies',count>1?3:-8);
  if(['fortify','siphon','steadfast','resolve','anchor','repulsion'].includes(card.key))add(parts,'Survival preference',Math.max(0,w.safety||0)*1.5);
  if(card.key==='velocity')add(parts,'Delivery reliability',type==='ranged'?3:1);
  if(card.key==='patience')add(parts,'Holding preference',type==='ranged'?2:0);
  const profile=TRAITS_BY_CARD[card.kind+':'+card.key]||{};
  for(const trait of TRAITS)if(profile[trait])add(parts,'Tactical preference: '+trait,(preferences[trait]||0)*profile[trait]*3.5);
  // Directional module pairings. Each side of a relationship is evaluated, and
  // expected value is capped to avoid rewarding endless repetition.
  const synergy=(k,other,strength,otherKind='attack')=>{
   if(card.key!==k)return;
   const amount=otherKind==='passive'?Number(has(other)):stack(other);
   if(amount)add(parts,'Works with '+other,Math.min(5,strength*amount));
  };
  synergy('piercing','projectiles',4);synergy('projectiles','piercing',4);
  synergy('area','piercing',2);synergy('piercing','area',2);
  synergy('hazardous','disruption',4);synergy('disruption','hazardous',4);
  synergy('chain','area',2.5);synergy('area','chain',2.5);
  synergy('burning','restless',3);synergy('restless','burning',3);
  synergy('restless','expose',3);synergy('expose','restless',3);
  synergy('momentum','dash',2,'passive');synergy('momentum','flank',2,'passive');
  synergy('momentum','haste',2,'passive');
  synergy('flank','momentum',3);synergy('dash','momentum',3);
  synergy('haste','momentum',3);
  synergy('burning','range',2);synergy('range','burning',2);
  synergy('disruption','knockback',1.5);synergy('knockback','disruption',1.5);
  const movement=w.safety+w.isolation*.5+w.preferredRange*.35;
  const pursue=w.distance+w.kill*.4;
  const mobile=clamp((movement+pursue)/4,0,2);
  if(card.kind==='attack'){
   if(card.key==='momentum')add(parts,'Movement-based combat style',(mobile-1)*3+(type==='rogue'?3:0));
   if(card.key==='burning')add(parts,'Hit-and-retreat potential',clamp(w.safety-.5,0,2)*2);
   if(card.key==='restless')add(parts,'Target-switching tendency',clamp(w.safety+w.isolation-1,0,2)*2);
   if(card.key==='range')add(parts,'Prefers distance',clamp(w.safety+w.preferredRange-1,0,2)*2);
   if(card.key==='precision')add(parts,'Kill-opportunity tendency',clamp(w.kill-.9,0,2)*2);
   if(card.key==='expose'){
    const others=player.squad.filter(x=>x!==unit);
    add(parts,'Other allies can consume marks',others.length?Math.min(6,others.length*3):-6);
    add(parts,'Ally protection focus',clamp(w.protection-1,0,2));
   }
   if(card.key==='taunt'&&count>1)add(parts,'Can protect other fighters',2);
   if(card.key==='chain'&&count===1)add(parts,'Spreads pressure across enemies',1.5);
   if(card.key==='hazardous'&&w.safety>1)add(parts,'Control while staying distant',2);
   if(card.key==='disengage')add(parts,'Safer after-attack retreat',clamp(w.safety-.4,0,3)*2+(type==='ranged'?2:0));
   if(card.key==='followthrough')add(parts,'Hit-triggered repositioning',type==='rogue'?5:type==='bruiser'?2:2);
   if(card.key==='projectiles'&&type==='ranged')add(parts,'Projectile spread',2);
   if(card.key==='area'&&type==='bruiser')add(parts,'Melee sweep reach',2);
   // Multiple stacks still work; their marginal value should be earned.
   const n=stack(card.key);
   if(n)add(parts,'Existing stacks reduce marginal value',-Math.min(9,n*2.5));
   if((card.key==='restless'||card.key==='chain')&&n>=3)add(parts,'Effect nearing cap',-5);
   if(card.key==='sunder'&&n>=3)add(parts,'Defense reduction capped',-6);
  }
  if(card.kind==='target'){
   const key=Object.keys(TARGET_MODULES[card.key]||{})[0]||TARGET_KEYS[card.key],current=w[key]||0;
   add(parts,'Existing targeting emphasis',current<=1?2:clamp(2-current,-5,0));
   if(card.key==='guardian'&&count>1)add(parts,'Protect teammates',3);
   if(card.key==='coward'&&stack('burning'))add(parts,'Safety complements burning',3);
   if(card.key==='executioner'&&stack('precision'))add(parts,'Finishing priority',2);
   if(card.key==='skirmisher'&&stack('range'))add(parts,'Use expanded attack range',2);
   if(card.key==='duelist'&&stack('restless'))add(parts,'Find alternate isolated targets',2);
  }
  if(card.kind==='utility'||card.kind==='passive'){
   const previous=slots.length>=2?slots[passiveSlot]:null;
   if(previous&&previous!==card.key&&!(card.kind==='utility'&&has(card.key))){
    // Replacement cost depends on the displaced ability, not merely slots being full.
    const oldKind=Object.hasOwn(BASE.utility,previous)?'utility':'passive';
    const oldValue=BASE[oldKind]?.[previous]||20;
    add(parts,'Replacing '+previous,-clamp(oldValue*.35,5,9));
   }
   if(card.kind==='utility'&&has(card.key)){
    add(parts,'Second copy only shortens cooldown',-7);
   }
   if(card.key==='intercept')add(parts,'Allies to defend',count>1?4:-7);
   if(card.key==='backstep'&&type==='ranged')add(parts,'Maintain projectile distance',4);
   if(card.key==='flank'&&type==='rogue')add(parts,'Exploit fast lateral approach',3);
   if(card.key==='dodge'&&w.safety>1)add(parts,'Survival-focused movement',2);
   if(card.key==='regen'&&type==='bruiser')add(parts,'Large health pool',3);
   if(card.key==='bulwark'&&type==='bruiser')add(parts,'Frontline durability',3);
   if(card.key==='focus'&&w.kill>1)add(parts,'Finishing behavior',2);
  }
 }
 const score=Number(parts.reduce((total,p)=>total+p.points,0).toFixed(4));
 return {score,parts,reasons:parts.filter(p=>p.reason!=='Base usefulness'&&p.reason!=='Another active fighter')
  .sort((a,b)=>Math.abs(b.points)-Math.abs(a.points)).slice(0,3).map(p=>p.reason+' '+(p.points>=0?'+':'')+p.points)};
}
export function scoreDraft(player,card,chassisIndex=0,passiveSlot=0,preferences={}){
 return evaluateDraft(player,card,chassisIndex,passiveSlot,preferences).score;
}
export function chooseCpuDraft(match,index){
 const player=match.players[index],preferences=draftPersonality(match.seed,index);
 let best=null;
 for(const card of match.draft.pool){
  if(!legal(player,card))continue;
  const slots=card.kind==='unit'?1:player.squad.length;
  for(let chassisIndex=0;chassisIndex<slots;chassisIndex++){
   if(card.kind!=='unit'&&!canEquip(player.squad[chassisIndex],card))continue;
   const passiveSlots=card.kind!=='unit'&&
    (card.kind==='passive'||card.kind==='utility')&&
    player.squad[chassisIndex].passives.length>=2?2:1;
   for(let passiveSlot=0;passiveSlot<passiveSlots;passiveSlot++){
    const evaluation=evaluateDraft(player,card,chassisIndex,passiveSlot,preferences);
    const variation=match.random()*2.5; // bounded seeded tie-breaking
    const adjusted=evaluation.score+variation;
    if(!best||adjusted>best.score)best={card,chassisIndex,passiveSlot,score:adjusted,
     baseScore:evaluation.score,reasons:evaluation.reasons,breakdown:evaluation.parts,
     preferences:{...preferences},variation:Number(variation.toFixed(3))};
   }
  }
 }
 if(!best)throw Error('No legal CPU draft pick');
 return best;
}
