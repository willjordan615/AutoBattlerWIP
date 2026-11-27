// Marginal value of equipped combinations, not a fixed build recipe.
import {CHASSIS,BASE_WEIGHTS,METRICS} from './engine/config.js?v=engine-360-r3';
import {TARGET_MODULES,UTILITY_MODULES,PASSIVE_MODULES} from './engine/module-registry.js?v=engine-360-r3';
import {assign,legal,canEquip} from './headless.js?v=engine-360-r3';
const cap=(x,max)=>Math.min(max,Math.max(0,x));
const CAPS={chain:4,sunder:3,burning:6,hazardous:5,restless:3,resonance:4,expose:4,fortify:4,siphon:4,steadfast:4,patience:4,rally:4,disruption:6};
const targetMetric=key=>Object.keys(TARGET_MODULES[key]||{})[0];
export function equippedStrength(u,key){
 const metric=targetMetric(key);
 if(metric)return Math.max(0,(u.weights[metric]||0)-(BASE_WEIGHTS[u.type][METRICS.indexOf(metric)]||0));
 if(UTILITY_MODULES.includes(key))return u.passives.includes(key)?Math.max(1,u.mods[key]||0):0;
 if(PASSIVE_MODULES.includes(key))return Number(u.passives.includes(key));
 return cap(u.mods[key]||0,CAPS[key]??Infinity);
}
// Each relationship describes a plausible mechanism, not an estimated win rate.
// Direction-independent relationships are counted only once per fighter.
const PAIRS=[
 ['momentum','duelist',2.4],['momentum','shrink',2.4],['momentum','haste',2],
 ['momentum','dash',2],['momentum','flank',2],['momentum','wake',1.2],
 ['hazardous','disruption',2.8],['hazardous','wake',1.5],
 ['burning','restless',2.4],['burning','disengage',2.4],['burning','coward',1.8],
 ['precision','challenger',2.5],['precision','restless',1.6],
 ['skirmisher','range',2.2],['aggressor','range',1.8],
 ['skirmisher','backstep',2],['coward','disengage',2.2],['coward','backstep',1.8],
 ['patience','anchor',2.5],['patience','regen',1.3],
 ['guardian','taunt',2.2],['guardian','bulwark',1.8],['taunt','growth',1.8],
 ['siphon','precision',1.8],['siphon','momentum',1.8],
 ['projectiles','piercing',2.4],['area','piercing',1.8],['projectiles','velocity',1.8],
 ['sunder','aggressor',1.3],['executioner','focus',1.6]
];
const ownPair=(a,b)=>Math.min(1.6,Math.sqrt(a*b));
const positive=(u,key)=>equippedStrength(u,key)>0;
const utilityUsers=u=>u.passives.filter(k=>['dash','dodge','backstep','flank','intercept','haste','focus','bulwark','aegis','anchor','repulsion'].includes(k)).length;
const receiveRate=(u,hasAlly)=>(1/CHASSIS[u.type].rate)*(positive(u,'shrink')?1.15:positive(u,'growth')?.9:1)*(hasAlly&&positive(u,'coordinated')?1.1:1);
export function buildCoherence(player,context={}){
 const edges=[],squad=player.squad;
 const add=(label,value)=>{if(value>0)edges.push({label,value});};
 for(const [slot,u] of squad.entries()){
  for(const [a,b,k] of PAIRS){
   if(['projectiles','piercing','area'].includes(a)&&context.opponentUnits===1)continue;
   const x=equippedStrength(u,a),y=equippedStrength(u,b);
   if(x&&y)add(slot+':'+a+' + '+b,k*ownPair(x,y));
  }
  for(const [other,v] of squad.entries())if(other!==slot){
   // Expose and Resonance work only with a different teammate. A quick
   // follow-up increases opportunity, but the same two fighters need not
   // both equip the same effect. Count provider -> recipient separately.
   const rate=cap(receiveRate(v,squad.length>1)/1.25,1.3);
   if(positive(u,'expose'))add(slot+'->'+other+':expose follow-up',1.6*Math.sqrt(cap(equippedStrength(u,'expose'),4))*rate);
   if(positive(u,'resonance'))add(slot+'<-'+other+':resonance setup',1.4*Math.sqrt(cap(equippedStrength(u,'resonance'),4))*rate);
   if(positive(u,'inspiration')&&utilityUsers(v))add(slot+'->'+other+':inspiration cooldowns',1.8*utilityUsers(v));
   if(positive(u,'guardian')&&v.type==='ranged')add(slot+'->'+other+':protect ranged ally',1.1*Math.sqrt(cap(equippedStrength(u,'guardian'),3)));
   if(positive(u,'taunt')&&(v.type==='ranged'||positive(v,'precision')))add(slot+'->'+other+':screen ally',1.3*Math.sqrt(cap(equippedStrength(u,'taunt'),3)));
   if(positive(u,'rally')&&positive(v,'momentum'))add(slot+'->'+other+':rally movement synergy',1.4*ownPair(equippedStrength(u,'rally'),equippedStrength(v,'momentum')));
   if(positive(u,'sunder')&&(positive(v,'aggressor')||positive(v,'precision')))add(slot+'->'+other+':shared defense reduction',1.2*Math.sqrt(cap(equippedStrength(u,'sunder'),3)));
  }
 }
 return {total:edges.reduce((n,e)=>n+e.value,0),edges};
}
// Apply the actual draft rules to a small private copy. No RNG, no combat
// rollout, no mutation of player, and no duplicate implementation of slot rules.
export function projectDraft(player,card,chassisIndex=0,passiveSlot=0){
 if(!legal(player,card)||card.kind!=='unit'&&!canEquip(player.squad[chassisIndex],card))return null;
 const projected={...player,squad:player.squad.map(u=>({...u,mods:{...u.mods},weights:{...u.weights},passives:[...u.passives],modules:u.modules.map(m=>({...m}))}))};
 const offer={...card,uid:'projection',name:card.name||card.key};
 const m={phase:'draft',players:[projected],draft:{pool:[offer],originalPool:[offer],order:[0],turn:0,picks:[]}};
 assign(m,0,offer.uid,chassisIndex,passiveSlot);
 return projected;
}
export function coherenceDelta(player,card,chassisIndex=0,passiveSlot=0,context={},before=buildCoherence(player,context)){
 const projected=projectDraft(player,card,chassisIndex,passiveSlot);
 if(!projected)return null;
 const after=buildCoherence(projected,context),old=new Map(before.edges.map(e=>[e.label,e.value])),next=new Map(after.edges.map(e=>[e.label,e.value]));
 const changed=[...new Set([...old.keys(),...next.keys()])].map(label=>({label,delta:(next.get(label)||0)-(old.get(label)||0)})).filter(e=>Math.abs(e.delta)>1e-8).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
 return {delta:after.total-before.total,changed};
}
export function refineCoherenceParts(player,card,slot,passiveSlot,context,parts){
 const change=coherenceDelta(player,card,slot,passiveSlot,context);
 if(!change||!change.changed.length)return parts;
 // Limit the incremental package term. The prior profile already values
 // standalone usefulness and some pairings. Negative delta matters just
 // as much as positive delta, including slot and morphology replacement.
 const points=Math.max(-8,Math.min(8,change.delta*.75));
 if(Math.abs(points)<1e-7)return parts;
 const label=change.changed[0].label.replace(/^\d+(?:[-<>]+\d+)?:/,'');
 return [...parts,{reason:(points>0?'Build complement: ':'Lost build complement: ')+label,points:Number(points.toFixed(2))}];
}
