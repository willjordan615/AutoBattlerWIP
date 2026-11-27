// Stable seeded lobby profiles: style and ability are independent.
import {EMPIRICAL_MODEL} from './draft-empirical-model.js?v=engine-360-r3';
export const BOT_STYLES=Object.freeze([
 {id:'versatile',name:'Versatile',traits:{}},
 {id:'mobile',name:'Mobile',traits:{mobility:1,control:.2}},
 {id:'durable',name:'Durable',traits:{survival:1,teamwork:.2}},
 {id:'controller',name:'Controller',traits:{control:1,coverage:.4}},
 {id:'selective',name:'Selective',traits:{focusFire:1,coverage:-.3}},
 {id:'cooperative',name:'Cooperative',traits:{teamwork:1,survival:.3}},
 {id:'wide',name:'Wide coverage',traits:{coverage:1,control:.3}},
 {id:'adaptive',name:'Adaptive',traits:{mobility:.4,focusFire:.4,survival:.3}}
].map(s=>Object.freeze({...s,traits:Object.freeze(s.traits)})));
export const BOT_SKILLS=Object.freeze([
 {id:'casual',weight:25,context:0.35,noise:8},
 {id:'regular',weight:50,context:0.7,noise:5},
 {id:'experienced',weight:25,context:1,noise:2.5}
].map(Object.freeze));
const mix=x=>{x=Math.imul(x^(x>>>16),0x21f0aaad);x=Math.imul(x^(x>>>15),0x735a2d97);return (x^(x>>>15))>>>0;};
const draw=(seed,seat,salt)=>mix((seed>>>0)^Math.imul(seat+1,0x9e3779b9)^salt)/4294967296;
function weightedSkill(roll){
 let n=roll*100;
 for(const s of BOT_SKILLS){n-=s.weight;if(n<0)return s;}
 return BOT_SKILLS.at(-1);
}
export function botProfile(seed,seat,basePreferences,override={}){
 const style=override.style?BOT_STYLES.find(x=>x.id===override.style):BOT_STYLES[Math.floor(draw(seed,seat,0x8a5cd789)*BOT_STYLES.length)];
 const skill=override.skill?BOT_SKILLS.find(x=>x.id===override.skill):weightedSkill(draw(seed,seat,0xc2b2ae35));
 if(!style||!skill)throw Error('Unknown bot profile');
 const preferences=Object.fromEntries(Object.entries(basePreferences).map(([key,v])=>[key,Math.round(Math.max(-1,Math.min(1,v*.55+(style.traits[key]||0)*.65))*1000)/1000]));
 return {id:style.id+':'+skill.id,style:style.id,skill:skill.id,preferences,context:skill.context,noise:skill.noise};
}
// Less experienced bots use less of the learned contextual evidence, rather
// than false rules or stat handicaps. All use learned general card values.
const contextual=k=>!(/^(card:|unit$|unit:|roster:)/.test(k));
const MODELS=new Map(BOT_SKILLS.map(skill=>[skill.id,skill.context===1?EMPIRICAL_MODEL:{
 ...EMPIRICAL_MODEL,weights:Object.fromEntries(Object.entries(EMPIRICAL_MODEL?.weights||{}).map(([k,v])=>[k,v*(contextual(k)?skill.context:1)]))
}]));
export function modelForBot(profile){return MODELS.get(profile.skill);}
