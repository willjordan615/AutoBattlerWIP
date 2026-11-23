import {CHASSIS} from './simulation.js?v=geometry-24';
import {legal,canEquip} from './headless.js?v=geometry-24';
// Profile 3: deterministic, explainable module scoring. Higher scores win.
export function scoreDraft(player,card,chassisIndex=0,passiveSlot=0){
 if(!legal(player,card))return -Infinity;
 if(card.kind!=='unit'&&!canEquip(player.squad[chassisIndex],card))return -Infinity;
 const unit=player.squad[chassisIndex],type=unit?.type||'bruiser';
 if(card.kind==='unit'){
 const count=player.squad.length,existing=player.squad.filter(u=>u.type===card.key).length;
 return 24+(count===1?24:count===2?9:0)+(existing===0?8:0)+(card.key==='bruiser'&&player.squad.every(u=>u.type!=='bruiser')?5:0);
 }
 if(!unit)return -Infinity;
 const st=CHASSIS[type],m=unit.mods;
 if(card.kind==='utility'){
 const scores={dash:type==='ranged'?12:28,dodge:24,backstep:type==='ranged'?31:15,flank:type==='rogue'?27:19,disengage:type==='ranged'?27:19,intercept:type==='bruiser'?28:14,followthrough:type==='rogue'?30:23};
 let score=(scores[card.key]||18);
 if(unit.passives.includes(card.key))score-=5;
 if(unit.passives.length===2)score-=8;
 return score;
 }
 if(card.kind==='attack'){
 const scores={damage:24+2/(st.damage+m.damage*2)*35,rate:25,range:type==='ranged'?19:26,projectiles:22,piercing:20,area:15,knockback:12,taunt:type==='bruiser'?29:21,range:type==='ranged'?23:25,sunder:24,precision:22,expose:player.squad.length>1?29:15,disruption:25,momentum:type==='rogue'?29:22,chain:24,burning:24,hazardous:23,restless:18,speed:type==='ranged'?19:25,hp:type==='bruiser'?26:19};
 let score=scores[card.key]||10;
 if(card.key==='projectiles')score+=m.piercing*5+Math.min(6,player.squad.length*2);
 if(card.key==='piercing')score+=m.projectiles*6;
 if(card.key==='range'&&type==='ranged')score+=Math.min(4,m.area*2);
 if(card.key==='chain')score+=Math.min(5,m.area*2);
 if(card.key==='hazardous')score+=Math.min(5,m.disruption*2);
 if(card.key==='expose')score+=Math.min(6,player.squad.length*2);
 if(card.key==='restless')score+=Math.min(5,m.expose*2);
 if(card.key==='hp'&&unit.passives.includes('regen'))score+=3;
 return score;
 }
 if(card.kind==='target'){
 const bonus={executioner:type==='rogue'?32:21,guardian:type==='bruiser'?28:16,skirmisher:type==='ranged'?31:19,coward:type==='ranged'?25:12,duelist:type==='rogue'?30:16,hunter:20,aggressor:24};
 const key={executioner:'kill',guardian:'protection',skirmisher:'preferredRange',coward:'safety',duelist:'isolation',hunter:'distance',aggressor:'damage'}[card.key];
 return (bonus[card.key]||18)-Math.max(0,unit.weights[key]-2)*2;
 }
 if(card.kind==='passive'){
 const scores={regen:type==='bruiser'?29:23,bulwark:type==='bruiser'?32:24,haste:type==='rogue'?29:25,focus:type==='ranged'?31:27,retaliation:type==='bruiser'?30:20};
 let score=scores[card.key]||20;
 if(unit.passives.includes(card.key))return -Infinity;
 if(unit.passives.length===2){const replaced=unit.passives[passiveSlot];if(replaced===card.key)return -20;score-=8}
 return score;
 }
 return 0;
}
export function chooseCpuDraft(match,index){
 const player=match.players[index];let best=null;
 for(const card of match.draft.pool){if(!legal(player,card))continue;
 const slots=card.kind==='unit'?1:player.squad.length;
 for(let chassisIndex=0;chassisIndex<slots;chassisIndex++){
 if(card.kind!=='unit'&&!canEquip(player.squad[chassisIndex],card))continue;
 const passiveSlots=(card.kind==='passive'||card.kind==='utility')&&player.squad[chassisIndex].passives.length>=2?2:1;
 for(let passiveSlot=0;passiveSlot<passiveSlots;passiveSlot++){
 const score=scoreDraft(player,card,chassisIndex,passiveSlot);
 // Seeded small variation avoids rigid choices without sacrificing strategic preferences.
 const adjusted=score+match.random()*3;
 if(!best||adjusted>best.score)best={card,chassisIndex,passiveSlot,score:adjusted}
 }}}
 if(!best)throw Error('No legal CPU draft pick');
 return best
}
