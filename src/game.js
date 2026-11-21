import {CHASSIS,ARENAS,STEP,tick,rng} from './simulation.js?v=combat-fx-6';
import {createMatch,draftPool,assign,legal,beginCombat,completeCombat} from './headless.js?v=combat-fx-6';
import {cardDetail} from './module-info.js?v=combat-fx-6';
import {chooseCpuDraft} from './draft-ai.js?v=combat-fx-6';
const $=id=>document.getElementById(id),canvas=$('arena'),ctx=canvas.getContext('2d');
const COLORS=['#64b3ff','#f58086','#f4d16f','#d3a2ff'];
let effects=[],match=null,battle=null,chosen=null,frame=0,last=0,acc=0,paused=false,view='start',lastResult=null,completedDraft=null;
function log(s){const d=document.createElement('div');d.textContent=s;$('log').prepend(d);while($('log').children.length>60)$('log').lastChild.remove()}
function button(text,detail,fn){const b=document.createElement('button');b.className='choice';const title=document.createElement('strong');title.textContent=text;const desc=document.createElement('span');desc.textContent=detail;b.append(title,desc);b.onclick=fn;return b}
function shortCard(card){if(card.kind==='unit')return 'New chassis · '+CHASSIS[card.key].hp+' HP';if(card.kind==='passive')return 'Passive · 1 of 2 slots';if(card.kind==='target')return 'Targeting priority +1';return ({damage:'+4 attack damage',rate:'Faster attacks',range:'+20 attack reach',projectiles:'+1 attack instance',piercing:'+1 extra target',area:'Wider attack',knockback:'Stronger knockback',speed:'+18 movement speed',hp:'+30 chassis combat HP'})[card.key]||'Attack upgrade'}
function reset(){effects=[];cancelAnimationFrame(frame);match=null;battle=null;chosen=null;lastResult=null;completedDraft=null;view='start';paused=false;acc=0;$('log').replaceChildren();$('results').textContent='Choose a starting chassis.';$('pause').disabled=true;$('step').disabled=true;$('pause').textContent='Pause';$('timer').textContent='0.0s';render();draw()}
function freshSeed(){if(globalThis.crypto?.getRandomValues){const values=new Uint32Array(1);globalThis.crypto.getRandomValues(values);return values[0]}return (Date.now()^Math.floor(Math.random()*0x100000000))>>>0}
function create(type){const seed=freshSeed(),random=rng(seed),bots=['bruiser','rogue','ranged'];for(let i=bots.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bots[i],bots[j]]=[bots[j],bots[i]]}match=createMatch([type,...bots],seed);draftPool(match);view='draft';chosen=null;log('Match created. First draft precedes combat.');processBots();render()}
function processBots(){while(match.phase==='draft'&&match.draft.order[match.draft.turn]!==0){const index=match.draft.order[match.draft.turn],choice=chooseCpuDraft(match,index);assign(match,index,choice.card.uid,choice.chassisIndex,choice.passiveSlot);log(match.players[index].name+' drafts '+choice.card.name)}if(match.phase==='combat')startCombat()}
function choose(card){chosen=card.uid;render()}
function takePick(){if(!chosen)return;const card=match.draft.pool.find(c=>c.uid===chosen);if(!card)return;const chassis=Number($('slot')?.value||0),passive=Number($('passiveSlot')?.value||0);assign(match,0,card.uid,chassis,passive);log('You draft '+card.name);chosen=null;processBots();render()}
function startCombat(){effects=[];battle=beginCombat(match);view='fight';last=performance.now();acc=0;paused=false;$('pause').disabled=false;$('step').disabled=false;$('pause').textContent='Pause';log('Round '+match.round+' begins: '+battle.arena.name);cancelAnimationFrame(frame);frame=requestAnimationFrame(loop);render()}
function endCombat(){completedDraft=match.draft;const result=completeCombat(match,battle);lastResult=result;view=match.phase==='finished'?'over':'results';$('pause').disabled=true;$('step').disabled=true;const lines=result.ranking.map((i,rank)=>match.players[i].name+' #'+(rank+1)+' · -'+result.damage[i]+' HP'+(result.remaining[i]===0?' · Eliminated':''));$('results').textContent=lines.join(' | ');lines.forEach(log);render()}
function next(){if(view!=='results')return;view='draft';chosen=null;processBots();render()}
function render(){const root=$('choices');root.replaceChildren();$('round').textContent='Round '+(view==='results'&&lastResult?lastResult.round:match?.round||1);const phase=$('phaseTitle'),info=$('phaseInfo'),status=$('status'),advance=$('advance');advance.style.display='none';advance.disabled=true;
 if(view==='start'){status.textContent='Choose a chassis';phase.textContent='Choose your starting chassis';info.textContent='Your first chassis is free. All additional chassis are draft cards.';for(const [id,c] of Object.entries(CHASSIS))root.append(button(c.name,c.desc+' · HP '+c.hp+' · Damage '+c.damage,()=>create(id)))}
 if(view==='draft'){status.textContent='Shared draft';phase.textContent='Round '+match.round+' draft';info.textContent='Pick '+(match.draft.turn+1)+' of '+match.draft.order.length+' · '+match.draft.pool.length+' cards remain. Claimed cards stay visible with their owner.';for(const card of match.draft.originalPool){
 const pick=match.draft.picks.find(p=>p.uid===card.uid);
 const available=match.draft.pool.some(p=>p.uid===card.uid);
 const allowed=available&&legal(match.players[0],card);
 const b=button(card.name,shortCard(card),()=>{if(allowed)choose(card)});
 b.classList.add('draft-card');
 b.setAttribute('aria-pressed',String(chosen===card.uid));
 if(chosen===card.uid)b.classList.add('selected');
 if(!allowed){b.disabled=true;b.classList.add('unavailable')}
 if(pick){
  b.classList.add('claimed');
  const tag=document.createElement('sup');
  tag.className='draft-owner';
  tag.textContent=pick.player===0?'You':'Bot '+pick.player;
  b.append(tag);
  b.setAttribute('aria-label',card.name+', selected by '+(pick.player===0?'you':'Bot '+pick.player));
 }else if(!allowed){
  b.classList.add('squad-full');
  const tag=document.createElement('sup');
  tag.className='draft-owner';
  tag.textContent='Full';
  b.append(tag);
  b.setAttribute('aria-label',card.name+', squad full');
 }
 root.append(b)
}
const card=match.draft.pool.find(c=>c.uid===chosen);if(card){const detail=document.createElement('div');detail.className='draft-detail';const heading=document.createElement('strong');heading.textContent=card.name;const body=document.createElement('p');body.textContent=cardDetail(card);detail.append(heading,body);root.append(detail)}if(card&&card.kind!=='unit'){const slot=document.createElement('select');slot.id='slot';match.players[0].squad.forEach((u,i)=>{const opt=document.createElement('option');opt.value=i;opt.textContent='Attach to '+(i+1)+'. '+CHASSIS[u.type].name;slot.append(opt)});root.append(slot);if(card.kind==='passive'){const passive=document.createElement('select');passive.id='passiveSlot';for(let i=0;i<2;i++){const opt=document.createElement('option');opt.value=i;opt.textContent='Replace passive slot '+(i+1)+' if full';passive.append(opt)}root.append(passive)}}advance.style.display='';advance.disabled=!chosen;advance.textContent='Confirm draft pick'}
 if(view==='fight'){status.textContent='Combat running';phase.textContent='Combat in progress';info.textContent='30-second maximum · automatic tactical combat'}
 if(view==='results'){status.textContent='Round complete';phase.textContent='Round '+lastResult.round+' complete';info.textContent='Review results, then continue to the next shared draft.';advance.style.display='';advance.disabled=false;advance.textContent='Next draft'}
 if(view==='over'){status.textContent='Match complete';phase.textContent='Match complete';info.textContent=match.players.find(p=>p.hp>0)?.name+' wins the match!'}
 const squad=$('squad');squad.replaceChildren();const heading=document.createElement('strong');heading.textContent='Your squad · '+(match?.players[0].squad.length||0)+'/3 chassis';squad.append(heading);for(const [i,u] of (match?.players[0].squad||[]).entries()){const row=document.createElement('div');row.className='fighter';row.textContent=(i+1)+'. '+CHASSIS[u.type].name+' · '+u.modules.map(m=>m.name).join(', ');squad.append(row)}renderStandings();renderDraftHistory()}
function renderDraftHistory(){const root=$('draftHistoryItems');root.replaceChildren();const draft=view==='results'||view==='over'?completedDraft:match?.draft;if(!draft)return;for(const card of draft.originalPool){const pick=draft.picks.find(p=>p.uid===card.uid),row=document.createElement('div');row.className='draft-history-row';const name=document.createElement('span');name.textContent=card.name;const owner=document.createElement('strong');owner.textContent=pick?match.players[pick.player].name:'Unpicked';if(pick)owner.style.color=COLORS[pick.player];row.append(name,owner);root.append(row)}}
function renderStandings(){const root=$('standings');root.replaceChildren();for(const [i,p] of (match?.players||[]).entries()){const d=document.createElement('div');d.className='stand';const label=document.createElement('span');label.textContent=p.name+(p.hp===0?' · OUT':'');label.style.color=COLORS[i];const value=document.createElement('span');value.textContent=p.hp+' HP';d.append(label,value);root.append(d)}}
// Effects are presentation-only. Combat damage is still resolved instantly in the engine.
function collectEffects(){if(!battle?.visualEvents?.length)return;const now=battle.time;for(const e of battle.visualEvents){if(e.kind==='damage'){effects.push({...e,born:now,duration:1.1})}else if(e.kind==='projectile'){effects.push({...e,born:now,duration:Math.max(.3,Math.min(.7,Math.hypot(e.toX-e.x,e.toY-e.y)/400))})}}if(effects.length>220)effects=effects.slice(-220)}
function drawEffects(){if(!battle)return;const now=battle.time;effects=effects.filter(e=>now-e.born<e.duration);for(const e of effects){const t=Math.max(0,Math.min(1,(now-e.born)/e.duration));if(e.kind==='projectile'){const x=e.x+(e.toX-e.x)*t,y=e.y+(e.toY-e.y)*t;ctx.save();ctx.globalAlpha=1-t*.45;ctx.strokeStyle=COLORS[e.owner];ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(e.x+(x-e.x)*.75,e.y+(y-e.y)*.75);ctx.lineTo(x,y);ctx.stroke();ctx.fillStyle='#fff4ca';ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.restore()}else{ctx.save();ctx.globalAlpha=Math.max(0,1-t);ctx.font='bold 16px system-ui';ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#142034';const x=e.x,y=e.y-26-t*26;const label='-'+Math.round(e.value);ctx.strokeText(label,x,y);ctx.fillStyle='#fff0d1';ctx.fillText(label,x,y);ctx.restore()}}}
function draw(){ctx.fillStyle='#19263a';ctx.fillRect(0,0,720,520);ctx.strokeStyle='#31415a';ctx.lineWidth=1;for(let x=20;x<720;x+=40){ctx.beginPath();ctx.moveTo(x,20);ctx.lineTo(x,500);ctx.stroke()}for(let y=20;y<520;y+=40){ctx.beginPath();ctx.moveTo(20,y);ctx.lineTo(700,y);ctx.stroke()}ctx.strokeStyle='#71829a';ctx.lineWidth=5;ctx.strokeRect(20,20,680,480);for(const o of battle?.arena?.obstacles||[]){ctx.fillStyle='#52617a';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.strokeStyle='#8b9bb2';ctx.strokeRect(o.x,o.y,o.w,o.h)}
 for(const u of battle?.units||[]){if(u.hp<=0)continue;const c=CHASSIS[u.type],r=c.radius;ctx.fillStyle=COLORS[u.owner];ctx.beginPath();ctx.arc(u.x,u.y,r+4,0,Math.PI*2);ctx.fill();ctx.fillStyle=c.fill;ctx.beginPath();ctx.arc(u.x,u.y,r-1,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0b1625';ctx.textAlign='center';ctx.font='bold 12px system-ui';ctx.fillText(u.type==='bruiser'?'B':u.type==='rogue'?'R':'A',u.x,u.y+4);ctx.fillStyle='#102033';ctx.fillRect(u.x-17,u.y-r-17,34,6);ctx.fillStyle='#77e7a3';ctx.fillRect(u.x-17,u.y-r-17,34*u.hp/u.maxHp,6)}drawEffects()}
function step(){if(view!=='fight')return;const result=tick(battle,STEP);collectEffects();for(const event of battle.events.splice(0))log(event);$('timer').textContent=battle.time.toFixed(1)+'s';if(result!==null)endCombat()}
function loop(now){const dt=Math.min(.08,(now-last)/1000);last=now;if(view==='fight'&&!paused){acc+=dt*Number($('speed').value||1);let count=0;while(acc>=STEP&&count++<12&&view==='fight'){step();acc-=STEP}}draw();if(view==='fight')frame=requestAnimationFrame(loop)}
$('advance').onclick=()=>view==='draft'?takePick():next();$('restart').onclick=reset;$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';last=performance.now()};$('step').onclick=()=>{paused=true;$('pause').textContent='Resume';step();draw()};reset();
