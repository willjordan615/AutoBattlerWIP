// Runtime scoring is a small sparse dot product, not a combat simulation.
// Features describe what changed; their signs and magnitudes are learned.
import {ATTACK_MODULES,TARGET_MODULES,UTILITY_MODULES,PASSIVE_MODULES,MORPHOLOGY_MODULES} from './engine/module-registry.js?v=engine-360-r4';
import {equippedStrength,projectDraft} from './draft-coherence.js?v=engine-360-r4';
const keys=[...ATTACK_MODULES,...Object.keys(TARGET_MODULES),...UTILITY_MODULES,...PASSIVE_MODULES,...MORPHOLOGY_MODULES];
const add=(x,k,v)=>{if(v)x[k]=(x[k]||0)+v;};
export function rosterFeatures(p,context={}){
 const x={},size=p.squad.length,opponents=context.opponents||0;
 for(const u of p.squad){
  add(x,'unit:'+u.type,1);add(x,'unit',1);
  const active=keys.map(k=>[k,equippedStrength(u,k)]).filter(([,v])=>v>0);
  for(const [k,v] of active){
   const n=Math.min(4,v);
   add(x,'card:'+k,n);
   add(x,'type:'+u.type+':'+k,n);
   add(x,'size:'+size+':'+k,n*.7);
   if(opponents===1)add(x,'duel:'+k,n*.5);
   add(x,'repeat:'+k,Math.max(0,n-1));
  }
  // All observed co-equipped pairs, including those not in the old graph.
  // No predefined sign or manual pair score.
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
   const [a,av]=active[i],[b,bv]=active[j];
   add(x,'pair:'+([a,b].sort().join('+')),Math.min(2,Math.sqrt(av*bv))*.7);
  }
  for(const v of p.squad)if(u!==v){
   for(const k of ['expose','resonance','rally','guardian','inspiration','aegis','taunt','sunder']){
    const strength=equippedStrength(u,k);
    if(strength)add(x,'ally:'+k+':'+v.type,Math.min(3,strength)*.7);
   }
   if(equippedStrength(u,'inspiration'))for(const k of v.passives)add(x,'allyCooldown:'+k,.7);
  }
 }
 add(x,'roster:'+size,1);
 return x;
}
export function empiricalFeatures(player,card,slot=0,passiveSlot=0,context={},before=rosterFeatures(player,context)){
 const next=projectDraft(player,card,slot,passiveSlot);
 if(!next)return null;
 const after=rosterFeatures(next,context),out={};
 for(const k of new Set([...Object.keys(before),...Object.keys(after)])){
  const delta=(after[k]||0)-(before[k]||0);if(Math.abs(delta)>1e-8)out[k]=delta;
 }
 return out;
}
export function predictDraft(features,model){
 if(!features||!model?.weights)return null;
 let value=0;
 for(const [k,v] of Object.entries(features))value+=(model.weights[k]||0)*v;
 return Math.max(-1,Math.min(1,value));
}
export function measuredParts(player,card,slot,passiveSlot,context,profile,neutral,model){
 const f=empiricalFeatures(player,card,slot,passiveSlot,context);
 const value=predictDraft(f,model);
 if(value===null)return profile.parts;
 // Keep a modest personality tie-breaker, not the old speculative base,
 // synergy, recruitment or replacement terms. Unit and slot losses are
 // represented by actual roster-feature differences.
 const taste=Math.max(-3,Math.min(3,(profile.score-neutral.score)*.4));
 return [{reason:'Measured round utility',points:Number((21+40*value).toFixed(2))},
  ...(taste?[{reason:'Persistent personality preference',points:Number(taste.toFixed(2))}]:[])];
}
