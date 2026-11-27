// Pure draft valuation: no engine rule changes, no hidden information, no RNG.
import {CHASSIS,BASE_WEIGHTS,METRICS} from './engine/config.js?v=engine-330-r1';
import {UTILITY_MODULES,TARGET_STAT_BONUSES} from './engine/module-registry.js?v=engine-330-r1';

const clamp=(v,l,h)=>Math.min(h,Math.max(l,v));
const sum=(xs,f)=>xs.reduce((n,x)=>n+f(x),0);
const EXTRA_TRAITS={
 'attack:velocity':{coverage:.6,focusFire:.5},'attack:rally':{teamwork:1,mobility:.4},
 'attack:resonance':{teamwork:1,focusFire:.7},'attack:fortify':{survival:1},
 'attack:siphon':{survival:1},'attack:steadfast':{survival:.8,control:.4},
 'attack:patience':{survival:.8,control:.4},'attack:resolve':{survival:.9,mobility:.4},
 'attack:ricochet':{coverage:.8,control:.7},
 'passive:aegis':{teamwork:1,survival:.5},'passive:inspiration':{teamwork:1,mobility:.5},
 'passive:anchor':{survival:1,control:.5},'passive:wake':{control:.8,mobility:.7},
 'passive:repulsion':{survival:.7,control:.8},
 'target:opportunist':{focusFire:.8,mobility:.4},'target:pursuer':{mobility:.8,focusFire:.4},
 'target:challenger':{focusFire:.7,control:.3}
};
// Weak priors only: 3.2 matched first-copy findings predate the 3.3 AI.
// No direct conversion of card win correlations to scores. Keep all shifts small.
const PRIORS={range:1.5,regen:1.5,coordinated:2,resolve:2,bulwark:1,hazardous:1,piercing:-1,area:-1};
const CAPS={sunder:3,chain:4,burning:6,hazardous:5,restless:3,resonance:4,fortify:4,siphon:4,steadfast:4,patience:4};
const coverageKeys=new Set(['projectiles','piercing','area','chain']);
const traitValue=(profile,prefs)=>sum(Object.entries(profile||{}),([k,v])=>(prefs[k]||0)*v);
const invested=u=>u.modules.filter(x=>x.kind==='attack'||x.kind==='target').length;
const baseWeight=(u,key)=>BASE_WEIGHTS[u.type][METRICS.indexOf(key)]||0;
export function draftContext(match,index){
 const opponents=match.players.filter((p,i)=>i!==index&&p.hp>0),units=opponents.flatMap(p=>p.squad);
 return {round:match.round,opponents:opponents.length,opponentUnits:units.length,
  rangedShare:units.length?units.filter(u=>u.type==='ranged').length/units.length:0,
  opponentTeams:opponents.filter(p=>p.squad.length>1).length,
  opponentSlowShare:units.length?units.filter(u=>(u.mods.disruption||0)>0||u.passives.includes('wake')).length/units.length:0};
}
export function refineDraftParts({player,card,chassisIndex,passiveSlot,preferences:p,context:c,parts:original,traits,legacyEvaluate}){
 const parts=original.map(x=>({...x}));
 const add=(reason,points)=>{if(Math.abs(points)>1e-7)parts.push({reason,points:Number(points.toFixed(2))})};
 const remove=reason=>{for(let i=parts.length-1;i>=0;i--)if(reason(parts[i].reason))parts.splice(i,1)};
 const count=player.squad.length,key=card.key,id=card.kind+':'+key;
 if(card.kind==='unit'){
  // Net team base capacity after the exact squad-size penalty. Existing flat
  // upgrades are not multiplied by that penalty, so only compare chassis base.
  const factor=n=>Math.max(.7,1-.15*(n-1));
  const current=player.squad.map(u=>CHASSIS[u.type]),newBase=CHASSIS[key];
  const hp=sum(current,u=>u.hp),output=sum(current,u=>u.damage/u.rate);
  const hpGain=(factor(count+1)*(hp+newBase.hp)-factor(count)*hp)/Math.max(1,factor(count)*hp);
  const outputGain=(factor(count+1)*(output+newBase.damage/newBase.rate)-factor(count)*output)/Math.max(1,factor(count)*output);
  // Replace generic penalty with actual relative capacity; bounded, not a combat simulator.
  remove(r=>r==='Extra chassis base-stat penalty'||r==='Teamwork tendency');
  add('Net squad base capacity',clamp(((hpGain+outputGain)/2-(count===1?.60:.23))*12,-8,8));
  add('Preserve established specialization',-Math.min(8,sum(player.squad,invested)*.75));
  add('Recruitment preference',(p.teamwork||0)*4);
  const support=sum(player.squad,u=>Number((u.mods.expose||0)>0)+Number((u.mods.resonance||0)>0)+Number(u.passives.includes('inspiration'))+Number(u.passives.includes('aegis')));
  add('New ally enables existing modules',Math.min(4,support*(count===1?2:1)));
  return parts;
 }
 const u=player.squad[chassisIndex],m=u.mods,w=u.weights,slots=u.passives,type=u.type;
 const stack=k=>m[k]||0;
 const peers=player.squad.filter(x=>x!==u);
 // Amplify coherent inclinations without prescribing a named build.
 const profile=traits[id]||EXTRA_TRAITS[id]||{};
 add('Persistent build inclination',traitValue(profile,p)*(traits[id]?2.5:6));
 if(PRIORS[key])add('Conservative historical prior',PRIORS[key]);
 // Old Precision/Executioner relationship contradicted the actual high-HP mechanic.
 if(key==='precision'||key==='executioner'){
  remove(r=>r==='Kill-opportunity tendency'||r==='Finishing priority');
  if(key==='precision')add('Healthy-target preference',clamp((w.challenger||0)*2.5,0,5));
 }
 if(key==='challenger'&&stack('precision'))add('Uses healthy-target bonus',Math.min(5,stack('precision')*2.5));
 if(card.kind==='target'){
  const metric=Object.keys({executioner:{kill:1},guardian:{protection:1},skirmisher:{preferredRange:1},coward:{safety:1},duelist:{isolation:1},hunter:{distance:1},aggressor:{damage:1},opportunist:{opportunist:1},pursuer:{pursuer:1},challenger:{challenger:1}}[key]||{})[0];
  const copies=metric?Math.max(0,(w[metric]||0)-baseWeight(u,metric)):0;
  add('Additional preference concentration',-Math.min(5,Math.max(0,copies-1)*1.25));
  if(TARGET_STAT_BONUSES[key])add('Hybrid stat benefit',key==='duelist'?2.5:2);
  if(key==='guardian')add('Protectable allies',peers.length?Math.min(3,peers.length*1.5):-5);
  if(key==='duelist'&&c.opponentUnits!=null)add('Isolated opponent opportunities',c.opponentUnits>c.opponents?1.5:0);
  if(key==='aggressor'&&stack('range'))add('Use accessible expanded range',Math.min(3,stack('range')*1.5));
  if(key==='coward'&&(stack('disengage')||slots.includes('backstep')))add('Retreat toolkit',2);
 }
 if(card.kind==='attack'){
  const cap=key==='ricochet'?(type==='ranged'?2:4):CAPS[key];
  if(cap&&stack(key)>=cap)add('No incremental capped effect',-24);
  if(key==='resonance'&&peers.length)add('Ally follow-up opportunities',Math.min(4,peers.length*2));
  if(key==='sunder'&&peers.length)add('Shared benefit of defense reduction',Math.min(3,peers.length*1.5));
  if(key==='rally'&&peers.length)add('Mobile teammates',Math.min(3,sum(peers,x=>Number(x.type!=='ranged'))*1.5));
  if(key==='resolve')add('Opposing slows',clamp((c.opponentSlowShare||0)*5,0,3));
  if(key==='velocity'&&type==='ranged'&&stack('projectiles'))add('Improve existing spread delivery',2);
  if(coverageKeys.has(key)&&c.opponentUnits===1)add('No secondary opponent available',-8);
 }
 if(card.kind==='passive'||card.kind==='utility'){
  const previous=slots.length>=2?slots[passiveSlot]:null;
  if(previous&&previous!==key&&!(card.kind==='utility'&&slots.includes(key))){
   remove(r=>r.startsWith('Replacing '));
   // Value the displaced module with the original evaluator on a cloned squad,
   // accounting for chassis, existing combinations and current preference.
   const oldKind=UTILITY_MODULES.includes(previous)?'utility':'passive';
   const oldUnit={...u,mods:{...m,[previous]:0},passives:slots.filter(x=>x!==previous)};
   const oldPlayer={...player,squad:player.squad.map((x,i)=>i===chassisIndex?oldUnit:x)};
   const oldScore=legacyEvaluate(oldPlayer,{kind:oldKind,key:previous},chassisIndex,0,p).score;
   const lost=Number.isFinite(oldScore)?clamp(oldScore*.55,7,18):10;
   const upgraded=oldKind==='utility'&&stack(previous)>1?4:0;
   add('Lose '+previous+' and its combinations',-(lost+upgraded));
  }
  if(key==='inspiration'){
   const uses=sum(peers,x=>x.passives.filter(k=>UTILITY_MODULES.includes(k)).length);
   add('Ally utility cooldowns',uses?Math.min(5,uses*2):-5);
  }
  if(key==='aegis'&&peers.length)add('Shield recipients',Math.min(3,peers.length*1.5));
  if(key==='coordinated')add('Unique general-stat package',1);
 }
 return parts;
}
