import {CHASSIS,ARENAS,STEP,tick,rng,stats,METRICS,positionScore,targetScoreDetails} from './simulation.js?v=dot-readouts-271';
import {createMatch,draftPool,assign,legal,canEquip,beginCombat,completeCombat} from './headless.js?v=dot-readouts-271';
import {cardDetail} from './module-info.js?v=dot-readouts-271';
import {chooseCpuDraft} from './draft-ai.js?v=dot-readouts-271';
const $=id=>document.getElementById(id),canvas=$('arena'),ctx=canvas.getContext('2d');
const COLORS=['#64b3ff','#f58086','#f4d16f','#d3a2ff'];
let effects=[],dotReadouts=new Map(),match=null,battle=null,chosen=null,frame=0,last=0,acc=0,paused=false,view='start',lastResult=null,completedDraft=null,inspected=null;
function log(s){const d=document.createElement('div');d.textContent=s;$('log').prepend(d);while($('log').children.length>60)$('log').lastChild.remove()}
function button(text,detail,fn){const b=document.createElement('button');b.className='choice';const title=document.createElement('strong');title.textContent=text;const desc=document.createElement('span');desc.textContent=detail;b.append(title,desc);b.onclick=fn;return b}
function shortCard(card){
 if(card.kind==='unit')return 'New chassis · '+CHASSIS[card.key].hp+' HP';
 if(card.kind==='utility')return 'Utility · one of 2 slots · second copy halves cooldown · '+(({dash:'Burst toward target',dodge:'Evasive roll',backstep:'Retreat from danger',flank:'Approach from the side',disengage:'Escape crowds',intercept:'Dash toward enemy threatening ally',followthrough:'Pass through targeted enemy'})[card.key]||'Mobility utility');
 if(card.kind==='passive')return 'Utility · occupies 1 of 2 slots · unique per chassis';
 if(card.kind==='target')return 'Targeting · priority +1';
 return 'Attack · '+(({projectiles:'+1 spread lane · no repeat hits',piercing:'+1 extra target',area:'Wider attack footprint',knockback:'Stronger knockback',taunt:'Force target to self · 0.25s per stack',range:'+8 reach',sunder:'Reduce enemy defense',precision:'Bonus against healthy enemies',expose:'Mark target for ally damage',disruption:'Slow enemies on hit',momentum:'Travel distance empowers hits',chain:'Redistribute damage to nearby enemies',burning:'Apply burning damage',hazardous:'Leave damaging terrain',restless:'Encourage target switching'})[card.key]||'Attack modifier');
}
function reset(){$('roundSummary').replaceChildren();effects=[];dotReadouts.clear();cancelAnimationFrame(frame);match=null;battle=null;chosen=null;lastResult=null;completedDraft=null;inspected=null;view='start';paused=false;acc=0;$('log').replaceChildren();$('results').textContent='Choose a starting chassis.';$('pause').disabled=true;$('step').disabled=true;$('pause').textContent='Pause';$('timer').textContent='0.0s';render();draw()}
function freshSeed(){if(globalThis.crypto?.getRandomValues){const values=new Uint32Array(1);globalThis.crypto.getRandomValues(values);return values[0]}return (Date.now()^Math.floor(Math.random()*0x100000000))>>>0}
function create(type){$('roundSummary').replaceChildren();const seed=freshSeed(),random=rng(seed),bots=['bruiser','rogue','ranged'];for(let i=bots.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bots[i],bots[j]]=[bots[j],bots[i]]}match=createMatch([type,...bots],seed);draftPool(match);view='draft';chosen=null;log('Match seed: '+seed+' · Bot chassis: '+bots.join(', '));log('Match created. First draft precedes combat.');processBots();render()}
function processBots(){while(match.phase==='draft'&&match.draft.order[match.draft.turn]!==0){const index=match.draft.order[match.draft.turn],choice=chooseCpuDraft(match,index);assign(match,index,choice.card.uid,choice.chassisIndex,choice.passiveSlot);log(match.players[index].name+' drafts '+choice.card.name)}if(match.phase==='combat')startCombat()}
function choose(card){chosen=card.uid;render()}
function takePick(){if(!chosen)return;const card=match.draft.pool.find(c=>c.uid===chosen);if(!card)return;const chassis=Number($('slot')?.value||0),passive=Number($('passiveSlot')?.value||0);assign(match,0,card.uid,chassis,passive);log('You draft '+card.name);chosen=null;processBots();render()}
function startCombat(){effects=[];dotReadouts.clear();battle=beginCombat(match);view='fight';last=performance.now();acc=0;paused=false;$('pause').disabled=false;$('step').disabled=false;$('pause').textContent='Pause';log('Round '+match.round+' begins: '+battle.arena.name);renderInspector();cancelAnimationFrame(frame);frame=requestAnimationFrame(loop);render()}
function endCombat(){
 completedDraft=match.draft;const result=completeCombat(match,battle);lastResult=result;
 view=match.phase==='finished'?'over':'results';$('pause').disabled=true;$('step').disabled=true;
 const lines=result.ranking.map((i,rank)=>match.players[i].name+' #'+(rank+1)+' · -'+result.damage[i]+' HP'+(result.remaining[i]===0?' · Eliminated':''));
 $('results').textContent=lines.join(' | ');lines.forEach(log);
 const summary=$('roundSummary');summary.replaceChildren();
 const header=document.createElement('strong');header.textContent='Your squad · combat breakdown';summary.append(header);
 const own=result.combatReport.filter(u=>u.owner===0);
 const fmt=n=>Math.round(n*10)/10;
 for(const u of own){
  const row=document.createElement('div');row.className='round-stat';
  const heading=document.createElement('strong');heading.textContent=CHASSIS[u.type].name+' #'+(u.id%100+1);
  const values=document.createElement('span');
  values.textContent=fmt(u.damage)+' dealt · '+fmt(u.damageTaken)+' taken'+
   (u.shots?' · '+u.hits+' hits / '+u.shots+' shots':' · '+u.attacks+' attacks')+
   (u.wallHits?' · '+u.wallHits+' wall impacts':'')+
   (u.interceptions?' · '+u.interceptions+' interceptions':'')+
   (u.dodges?' · '+u.dodges+' dodge rolls':'')+
   (u.evaded?' · '+u.evaded+' attacks evaded':'')+
   (u.prevented?' · '+fmt(u.prevented)+' blocked':'')+
   (u.haste?' · '+u.haste+' haste':'')+
   (u.focus?' · '+u.focus+' focus':'')+
   (u.bulwark?' · '+u.bulwark+' bulwark':'');
  row.append(heading,values);summary.append(row);
 }
 const totals=document.createElement('div');totals.className='round-team-totals';
 totals.textContent='Team damage · '+match.players.map((player,index)=>{
  const amount=result.combatReport.filter(u=>u.owner===index).reduce((sum,u)=>sum+u.damage,0);
  return player.name+' '+fmt(amount);
 }).join(' · ');
 summary.append(totals);
 render();renderInspector();
}
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
  tag.textContent=card.kind==='unit'?'Full':'No slot';
  b.append(tag);
  b.setAttribute('aria-label',card.name+', squad full');
 }
 root.append(b)
}
const card=match.draft.pool.find(c=>c.uid===chosen);if(card){const detail=document.createElement('div');detail.className='draft-detail';const heading=document.createElement('strong');heading.textContent=card.name;const body=document.createElement('p');body.textContent=cardDetail(card);detail.append(heading,body);root.append(detail)}if(card&&card.kind!=='unit'){
 const slot=document.createElement('select');slot.id='slot';
 match.players[0].squad.forEach((u,i)=>{
  if(!canEquip(u,card))return;
  const opt=document.createElement('option');opt.value=i;
  opt.textContent='Attach to '+(i+1)+'. '+CHASSIS[u.type].name+
   (card.kind==='utility'&&u.passives.includes(card.key)?' · upgrade to 2 copies':'');
  slot.append(opt);
 });
 root.append(slot);
 if(card.kind==='passive'||card.kind==='utility'){
  const passive=document.createElement('select');passive.id='passiveSlot';
  for(let i=0;i<2;i++){
   const opt=document.createElement('option');opt.value=i;
   opt.textContent='Replace utility slot '+(i+1)+' if full';passive.append(opt);
  }
  root.append(passive);
 }
}
advance.style.display='';advance.disabled=!chosen;advance.textContent='Confirm draft pick'}
 if(view==='fight'){status.textContent='Combat running';phase.textContent='Combat in progress';info.textContent='30-second maximum · timeout favors damage dealt'}
 if(view==='results'){status.textContent='Round complete';phase.textContent='Round '+lastResult.round+' complete';info.textContent='Review results, then continue to the next shared draft.';advance.style.display='';advance.disabled=false;advance.textContent='Next draft'}
 if(view==='over'){status.textContent='Match complete';phase.textContent='Match complete';info.textContent=match.players.find(p=>p.hp>0)?.name+' wins the match!'}
 const squad=$('squad');squad.replaceChildren();const heading=document.createElement('strong');heading.textContent='Your squad · '+(match?.players[0].squad.length||0)+'/3 chassis';squad.append(heading);for(const [i,u] of (match?.players[0].squad||[]).entries()){const row=document.createElement('div');row.className='fighter';row.textContent=(i+1)+'. '+CHASSIS[u.type].name+' · '+u.modules.map(m=>m.name).join(', ');squad.append(row)}renderStandings();renderDraftHistory();renderInspector()}
const LABELS={kill:'Kill Opportunity',damage:'Damage Opportunity',threat:'Threat',distance:'Target Distance',allyProximity:'Ally Proximity',safety:'Safety',protection:'Protection',ability:'Ability Readiness',isolation:'Isolation',preferredRange:'Preferred Range'};
const UTILITY_COOLDOWNS={dash:5,dodge:5,backstep:4.5,flank:4,disengage:6,intercept:5,followthrough:6};
function selectFighter(owner,slot){inspected={owner,slot};renderInspector();draw()}
function renderInspector(){
 const root=$('inspector');if(!root)return;
 root.replaceChildren();
 const heading=document.createElement('h2');heading.textContent='Character inspector';root.append(heading);
 if(!match){const p=document.createElement('p');p.className='muted';p.textContent='Select a character during combat or between rounds.';root.append(p);return}
 const picker=document.createElement('div');picker.className='inspector-picker';
 match.players.forEach((p,owner)=>p.squad.forEach((ch,slot)=>{const btn=document.createElement('button');btn.className='secondary';btn.textContent=p.name+' · '+(slot+1)+' '+CHASSIS[ch.type].name;btn.style.borderColor=COLORS[owner];btn.setAttribute('aria-pressed',String(inspected?.owner===owner&&inspected?.slot===slot));btn.onclick=()=>selectFighter(owner,slot);picker.append(btn)}));
 root.append(picker);
 if(!inspected)return;
 const player=match.players[inspected.owner],ch=player?.squad[inspected.slot];if(!ch)return;
 const live=battle?.units.find(u=>u.owner===inspected.owner&&u.id%100===inspected.slot);
 const st=stats({type:ch.type,chassis:ch,squadSize:player.squad.length});
 const line=(title,value)=>{const row=document.createElement('div');row.className='inspector-line';const k=document.createElement('span');k.textContent=title;const v=document.createElement('strong');v.textContent=String(value);row.append(k,v);root.append(row)};
 const section=title=>{const h=document.createElement('h3');h.textContent=title;root.append(h)};
 const format=n=>Number(n).toFixed(2).replace(/\\.00$/,'');
 section(player.name+' · '+CHASSIS[ch.type].name+' #'+(inspected.slot+1));
 line('State',live?(live.hp>0?'Active':'Defeated'):'Between rounds / not deployed');
 line('Squad strength',Math.round((1-.15*(player.squad.length-1))*100)+'% base HP and damage ('+player.squad.length+' chassis)');
 line('Combat HP',live?format(live.hp)+' / '+format(live.maxHp):format(st.hp)+' maximum');
 line('Damage / Defense',format(st.damage)+' / '+st.defense);
 line('Attack range / interval',st.range+' / '+format(st.rate)+'s');
 line('Movement speed',format(st.speed));
 line('Attack lanes / pierce',st.projectiles+' / '+st.piercing);
 line('Attack modules',Object.entries(ch.mods).filter(([key,v])=>v>0&&!UTILITY_COOLDOWNS[key]&&['range','sunder','precision','expose','disruption','momentum','chain','burning','hazardous','restless','area','projectiles','piercing','knockback','taunt'].includes(key)).map(([key,v])=>key+' ×'+v).join(', ')||'None');
 line('Area / knockback / taunt',st.area+' / '+st.knockback+' / '+st.taunt);
 section('AI weights · exact values');
 for(const key of METRICS)line(LABELS[key]||key,format(ch.weights[key]||0));
 section('Draft upgrades');
 const mods=Object.entries(ch.mods).filter(([,v])=>v>0).map(([k,v])=>k+' ×'+v);
 line('Modules',mods.join(', ')||'None');
 line('Utility slots',ch.passives.join(', ')||'None');
 if(live&&battle){
  section('Combat decision · '+format(battle.time)+'s');
  const enemies=battle.units.filter(u=>u.hp>0&&u.owner!==live.owner);
  const target=enemies.find(e=>e.id===live.focus);
  line('Current target',target?match.players[target.owner].name+' · '+CHASSIS[target.type].name+' #'+(target.id%100+1):'None');
  if(target){const details=targetScoreDetails(battle,live,target);
   line('Target score',format(details.total));
   const ranked=Object.entries(details.contributions).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
   for(const [key,value] of ranked)line('↳ '+(LABELS[key]||key),format(value));
  }
  const forced=live.tauntedUntil>battle.time;
  line('Targeting override',forced?'Taunted by unit '+live.tauntedBy:'None');
  line('Movement direction',live.moveDecision?(Math.abs(live.moveDecision.x)+Math.abs(live.moveDecision.y)<.001?'Hold position':format(live.moveDecision.x)+', '+format(live.moveDecision.y)):'Not evaluated');
  if(target){
   const blocked=!lineOfSight(live,target);
   line('Direct route',blocked?'Obstacle blocking · navigating':'Clear');
   line('Position score',format(positionScore(battle,live,target,live,st,enemies)));
  }
  line('Attack cooldown',format(Math.max(0,live.cd))+'s');
  for(const [key,seconds] of Object.entries(UTILITY_COOLDOWNS))if(st[key])line(key+' ×'+st[key],format(Math.max(0,(live.mobilityCd?.[key]||0)-battle.time))+'s remaining / '+seconds+'s base');
  if(live.evadingUntil>battle.time)line('Evading',format(live.evadingUntil-battle.time)+'s');
  if(live.phasingUntil>battle.time)line('Follow Through',format(live.phasingUntil-battle.time)+'s');
 }else if(battle&&view!=='fight'){const note=document.createElement('p');note.className='muted';note.textContent='Round complete. Configuration is current; the last combat state is shown when available.';root.append(note)}
}
function lineOfSight(a,b){const arena=battle?.arena;if(!arena)return true;return !arena.obstacles.some(o=>{const steps=24;for(let i=0;i<=steps;i++){const x=a.x+(b.x-a.x)*i/steps,y=a.y+(b.y-a.y)*i/steps;if(x>=o.x&&x<=o.x+o.w&&y>=o.y&&y<=o.y+o.h)return true}return false})}
canvas.addEventListener('click',event=>{
 if(!battle||!match)return;
 const bounds=canvas.getBoundingClientRect(),x=(event.clientX-bounds.left)*canvas.width/bounds.width,y=(event.clientY-bounds.top)*canvas.height/bounds.height;
 let closest=null,d=Infinity;
 for(const u of battle.units){const r=CHASSIS[u.type].radius+13,dist=Math.hypot(u.x-x,u.y-y);if(dist<=r&&dist<d){closest=u;d=dist}}
 if(closest)selectFighter(closest.owner,closest.id%100);
});
function renderDraftHistory(){const root=$('draftHistoryItems');root.replaceChildren();const draft=view==='results'||view==='over'?completedDraft:match?.draft;if(!draft)return;for(const card of draft.originalPool){const pick=draft.picks.find(p=>p.uid===card.uid),row=document.createElement('div');row.className='draft-history-row';const name=document.createElement('span');name.textContent=card.name;const owner=document.createElement('strong');owner.textContent=pick?match.players[pick.player].name:'Unpicked';if(pick)owner.style.color=COLORS[pick.player];row.append(name,owner);root.append(row)}}
function renderStandings(){const root=$('standings');root.replaceChildren();for(const [i,p] of (match?.players||[]).entries()){const d=document.createElement('div');d.className='stand';const label=document.createElement('span');label.textContent=p.name+(p.hp===0?' · OUT':'');label.style.color=COLORS[i];const value=document.createElement('span');value.textContent=p.hp+' HP';d.append(label,value);root.append(d)}}
// Damage and impact animations are generated by authoritative combat events.
// Live projectiles are rendered directly from the engine, never faked as hitscan.
function collectEffects(){
 if(!battle)return;
 const now=battle.time;
 for(const e of battle.visualEvents||[]){
  if(e.kind==='dotDamage'){
   // Gather fractional ticks per victim into readable, infrequent totals.
   const previous=dotReadouts.get(e.targetId);
   const entry=previous||{value:0,x:e.x,y:e.y,owner:e.owner,lastShown:now};
   entry.value+=e.value;entry.x=e.x;entry.y=e.y;
   dotReadouts.set(e.targetId,entry);
  }else if(e.kind==='damage')effects.push({...e,born:now,duration:1.1});
  else if(e.kind==='mobility')effects.push({...e,born:now,duration:.3});
  else if(e.kind==='impact')effects.push({...e,born:now,duration:.18});
  else if(e.kind==='wallImpact')effects.push({...e,born:now,duration:.16});
  else if(e.kind==='attackCommit')effects.push({...e,born:now,duration:.14});
  else if(e.kind==='chain')effects.push({...e,born:now,duration:.18});
 }
 for(const [id,entry] of dotReadouts){
  if(now-entry.lastShown<.4)continue;
  if(entry.value>0){
   effects.push({kind:'damage',dot:true,x:entry.x,y:entry.y,
    value:entry.value,owner:entry.owner,born:now,duration:1.1});
  }
  dotReadouts.delete(id);
 }
 if(effects.length>220)effects=effects.slice(-220);
}
function drawEffects(){
 if(!battle)return;
 const now=battle.time;
 effects=effects.filter(e=>now-e.born<e.duration);
 for(const e of effects){
  const t=Math.max(0,Math.min(1,(now-e.born)/e.duration));
  if(e.kind==='mobility'){
   ctx.save();ctx.globalAlpha=(1-t)*.7;ctx.strokeStyle=COLORS[e.owner];
   ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(e.x,e.y);
   ctx.lineTo(e.toX,e.toY);ctx.stroke();ctx.restore();
  }else if(e.kind==='attackCommit'){
   // Compact, fading white attack cue; cosmetic only, with no stroke or particles.
   ctx.save();ctx.globalAlpha=(1-t)*.5;ctx.fillStyle='#ffffff';
   ctx.beginPath();
   const forward=(distance,side=0)=>{
    const angle=e.angle+Math.PI/2;
    return [e.x+Math.cos(e.angle)*distance+Math.cos(angle)*side,
            e.y+Math.sin(e.angle)*distance+Math.sin(angle)*side];
   };
   if(e.type==='bruiser'){
    // Short curved sweep centered on the committed facing direction.
    const half=Math.min(e.arc*Math.PI/360,.48);
    ctx.arc(e.x,e.y,35,e.angle-half,e.angle+half);
    ctx.arc(e.x,e.y,26,e.angle+half,e.angle-half,true);
    ctx.closePath();
   }else{
    // Small tapered thrust/aim glint extending forward from the fighter.
    const start=e.type==='rogue'?24:19;
    const end=e.type==='rogue'?45:39;
    const width=e.type==='rogue'?5:3.5;
    const a=forward(start,-width),b=forward(end),c=forward(start,width);
    ctx.moveTo(...a);ctx.lineTo(...b);ctx.lineTo(...c);ctx.closePath();
   }
   ctx.fill();ctx.restore();
  }else if(e.kind==='chain'){
   ctx.save();ctx.globalAlpha=(1-t)*.55;ctx.strokeStyle='#ffffff';ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.toX,e.toY);ctx.stroke();ctx.restore();
  }else if(e.kind==='wallImpact'){
   ctx.save();ctx.globalAlpha=1-t;ctx.strokeStyle='#f8d991';ctx.lineWidth=1.5;
   ctx.beginPath();
   for(let i=0;i<4;i++){
    const angle=i*Math.PI/2+.35;
    ctx.moveTo(e.x+Math.cos(angle)*2,e.y+Math.sin(angle)*2);
    ctx.lineTo(e.x+Math.cos(angle)*(4+7*t),e.y+Math.sin(angle)*(4+7*t));
   }
   ctx.stroke();ctx.restore();
  }else if(e.kind==='impact'){
   ctx.save();ctx.globalAlpha=1-t;ctx.strokeStyle=COLORS[e.owner];
   ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,3+t*9,0,Math.PI*2);
   ctx.stroke();ctx.restore();
  }else{
   ctx.save();ctx.globalAlpha=Math.max(0,1-t);ctx.font='bold 16px system-ui';
   ctx.textAlign='center';ctx.lineWidth=4;ctx.strokeStyle='#142034';
   const x=e.x,y=e.y-26-t*26;
   const label='-'+(e.dot||e.value<.5?(e.value<.1?e.value.toFixed(2):e.value.toFixed(1)):Math.round(e.value));
   ctx.strokeText(label,x,y);ctx.fillStyle='#fff0d1';
   ctx.fillText(label,x,y);ctx.restore();
  }
 }
 for(const shot of battle.projectiles||[]){
  ctx.save();ctx.strokeStyle=COLORS[shot.owner];ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(shot.x-shot.vx*11,shot.y-shot.vy*11);
  ctx.lineTo(shot.x,shot.y);ctx.stroke();
  ctx.fillStyle='#fff4ca';ctx.beginPath();
  ctx.arc(shot.x,shot.y,3.5,0,Math.PI*2);ctx.fill();ctx.restore();
 }
}

function draw(){ctx.fillStyle='#19263a';ctx.fillRect(0,0,720,520);ctx.strokeStyle='#31415a';ctx.lineWidth=1;for(let x=20;x<720;x+=40){ctx.beginPath();ctx.moveTo(x,20);ctx.lineTo(x,500);ctx.stroke()}for(let y=20;y<520;y+=40){ctx.beginPath();ctx.moveTo(20,y);ctx.lineTo(700,y);ctx.stroke()}ctx.strokeStyle='#71829a';ctx.lineWidth=5;ctx.strokeRect(20,20,680,480);for(const o of battle?.arena?.obstacles||[]){ctx.fillStyle='#52617a';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.strokeStyle='#8b9bb2';ctx.strokeRect(o.x,o.y,o.w,o.h)}for(const z of battle?.zones||[]){
 ctx.save();ctx.globalAlpha=Math.max(0,Math.min(.18,(z.until-battle.time)*.08));
 ctx.fillStyle='#f5a85d';ctx.beginPath();ctx.arc(z.x,z.y,z.radius,0,Math.PI*2);ctx.fill();
 ctx.restore();
}
 for(const u of battle?.units||[]){if(u.hp<=0)continue;const c=CHASSIS[u.type],r=c.radius;ctx.fillStyle=COLORS[u.owner];ctx.beginPath();ctx.arc(u.x,u.y,r+4,0,Math.PI*2);ctx.fill();if(inspected&&inspected.owner===u.owner&&inspected.slot===u.id%100){ctx.strokeStyle='#ffffff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(u.x,u.y,r+8,0,Math.PI*2);ctx.stroke();}ctx.fillStyle=c.fill;ctx.beginPath();ctx.arc(u.x,u.y,r-1,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0b1625';ctx.textAlign='center';ctx.font='bold 12px system-ui';ctx.fillText(u.type==='bruiser'?'B':u.type==='rogue'?'R':'A',u.x,u.y+4);ctx.fillStyle='#102033';ctx.fillRect(u.x-17,u.y-r-17,34,6);ctx.fillStyle='#77e7a3';ctx.fillRect(u.x-17,u.y-r-17,34*u.hp/u.maxHp,6)}drawEffects()}
function step(){if(view!=='fight')return;const result=tick(battle,STEP);collectEffects();for(const event of battle.events.splice(0))log(event);$('timer').textContent=battle.time.toFixed(1)+'s';if(result!==null)endCombat();else if(inspected&&battle.tick%6===0)renderInspector()}
function loop(now){const dt=Math.min(.08,(now-last)/1000);last=now;if(view==='fight'&&!paused){acc+=dt*Number($('speed').value||1);let count=0;while(acc>=STEP&&count++<12&&view==='fight'){step();acc-=STEP}}draw();if(view==='fight')frame=requestAnimationFrame(loop)}
$('advance').onclick=()=>view==='draft'?takePick():next();$('restart').onclick=reset;$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';last=performance.now()};$('step').onclick=()=>{paused=true;$('pause').textContent='Resume';step();draw()};reset();
