import {ARENAS,CHASSIS,STEP,spawn,tick,teamPercent,placementGroups,resolvePlayerHP,makeChassis,rng} from './simulation.js?v=match-random-7';
// Headless match orchestration: no DOM, Canvas or wall-clock dependencies.
export const ATTACK_MODULES=['damage','rate','range','projectiles','piercing','area','knockback','speed','hp'];
export const TARGET_MODULES={
 executioner:{kill:1},guardian:{protection:1},skirmisher:{preferredRange:1},
 coward:{safety:1},duelist:{isolation:1},hunter:{distance:1},aggressor:{damage:1}
};
export const PASSIVE_MODULES=['regen','bulwark','haste','focus'];
export const catalog=[
 ...Object.keys(CHASSIS).map(type=>({kind:'unit',key:type,name:'Recruit '+CHASSIS[type].name})),
 ...ATTACK_MODULES.map(key=>({kind:'attack',key,name:'Attack: '+key})),
 ...Object.keys(TARGET_MODULES).map(key=>({kind:'target',key,name:'Targeting: '+key})),
 ...PASSIVE_MODULES.map(key=>({kind:'passive',key,name:'Passive: '+key}))
];
export function createMatch(types=['bruiser','rogue','ranged','bruiser'],seed=12345){
 const random=rng(seed);
 return {seed,random,round:1,phase:'draft',players:types.map((type,i)=>({name:i===0?'You':'Bot '+i,hp:100,streak:0,squad:[makeChassis(type)]})),lastRanking:[],lastSpawnSlots:null,draft:null,history:[]}
}
export function legal(player,card){return player.hp>0&&(card.kind!=='unit'||player.squad.length<3)}
export function draftPool(match){
 const active=match.players.map((p,i)=>p.hp>0?i:-1).filter(i=>i>=0);
 const pool=Array.from({length:active.length+2},(_,i)=>({...catalog[Math.floor(match.random()*catalog.length)],uid:match.round+'-'+i}));
 const full=active.length;
 let available=pool.filter(x=>x.kind!=='unit').length;
 for(let i=pool.length-1;i>=0&&available<full;i--)if(pool[i].kind==='unit'){pool[i]={...catalog.filter(x=>x.kind!=='unit')[Math.floor(match.random()*(catalog.length-3))],uid:pool[i].uid};available++}
 const order=match.lastRanking.length?match.lastRanking.filter(i=>match.players[i].hp>0).reverse():active;
 match.draft={pool,originalPool:pool.map(card=>({...card})),order,turn:0,picks:[]};match.phase='draft';return match.draft
}
export function assign(match,playerIndex,cardUid,chassisIndex=0,passiveSlot=0){
 const d=match.draft;if(match.phase!=='draft'||!d||d.order[d.turn]!==playerIndex)throw Error('Not this player\'s draft turn');
 const player=match.players[playerIndex],index=d.pool.findIndex(c=>c.uid===cardUid);if(index<0)throw Error('Card not available');
 const card=d.pool[index];if(!legal(player,card))throw Error('Illegal draft pick');
 if(card.kind==='unit')player.squad.push(makeChassis(card.key));
 else{const unit=player.squad[chassisIndex];if(!unit)throw Error('Invalid chassis slot');
 if(card.kind==='attack')unit.mods[card.key]++;
 if(card.kind==='target')for(const [key,value] of Object.entries(TARGET_MODULES[card.key]))unit.weights[key]+=value;
 const assignedSlot=unit.passives.length<2?unit.passives.length:passiveSlot;if(card.kind==='passive'){if(unit.passives.length<2)unit.passives.push(card.key);else{if(!Number.isInteger(passiveSlot)||passiveSlot<0||passiveSlot>1)throw Error('Invalid passive slot');unit.passives[passiveSlot]=card.key}}
 if(card.kind==='passive'){unit.modules=unit.modules.filter(m=>m.passiveSlot!==(assignedSlot+1));unit.modules.push({kind:card.kind,name:card.name,passiveSlot:assignedSlot+1})}else unit.modules.push({kind:card.kind,name:card.name})}
 d.pool.splice(index,1);d.picks.push({player:playerIndex,uid:card.uid,card:card.name,chassisIndex});d.turn++;if(d.turn===d.order.length)match.phase='combat';return card
}
export function autoDraft(match){if(!match.draft)draftPool(match);while(match.phase==='draft'){const d=match.draft,i=d.order[d.turn],p=match.players[i];const legalCards=d.pool.filter(c=>legal(p,c));const card=legalCards[Math.floor(match.random()*legalCards.length)];assign(match,i,card.uid,Math.floor(match.random()*p.squad.length),Math.floor(match.random()*2))}return match.draft.picks}
function duel(match,a,b){const players=match.players.map((p,i)=>({...p,hp:i===a||i===b?100:0}));const battle=spawn(players,ARENAS[(match.round-1)%ARENAS.length],match.seed+match.round*101+a*13+b*7,match.round);for(let t=0;t<900;t++)if(tick(battle,STEP)!==null)break;const x=teamPercent(battle,a),y=teamPercent(battle,b);return x!==y?x>y?a:b:Math.min(a,b)}
export function rankRound(match,battle){const groups=placementGroups(battle),ranking=[];for(const group of groups){if(group.length===1){ranking.push(group[0]);continue}const wins=new Map(group.map(i=>[i,0]));for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){const winner=duel(match,group[i],group[j]);wins.set(winner,wins.get(winner)+1)}ranking.push(...group.sort((a,b)=>wins.get(b)-wins.get(a)||a-b))}return ranking}
export function beginCombat(match){if(match.phase!=='combat')throw Error('Complete the draft first');const battle=spawn(match.players,ARENAS[(match.round-1)%ARENAS.length],match.seed+match.round*991,match.round,match.lastSpawnSlots);match.lastSpawnSlots=battle.spawnSlots.slice();return battle}
export function completeCombat(match,battle){if(match.phase!=='combat')throw Error('Combat already resolved');const ranking=rankRound(match,battle);const before=match.players.map(p=>p.hp);resolvePlayerHP(match.players,ranking,match.round);match.lastRanking=ranking;const result={round:match.round,ranking,damage:before.map((hp,i)=>hp-match.players[i].hp),remaining:match.players.map(p=>p.hp),time:battle.time,eliminations:battle.eliminations};match.history.push(result);if(match.players.filter(p=>p.hp>0).length<=1)match.phase='finished';else{match.round++;draftPool(match)}return result}
export function fight(match){const battle=beginCombat(match);for(let t=0;t<900;t++)if(tick(battle,STEP)!==null)break;return completeCombat(match,battle)}
export function simulate(seed=12345,maxRounds=250){const match=createMatch(undefined,seed);draftPool(match);while(match.phase!=='finished'&&match.round<=maxRounds){autoDraft(match);fight(match)}return match}
