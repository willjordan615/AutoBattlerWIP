import {CHASSIS,ARENAS,STEP,tick,rng,stats,METRICS,positionScore,targetScoreDetails,radiusOf,morphologyTier} from './simulation.js?v=engine-360-r4';
import {createMatch,draftPool,assign,legal,canEquip,beginCombat,completeCombat} from './headless.js?v=engine-360-r4';
import {cardDetail,cardSummary} from './module-info.js?v=engine-360-r4';
import {chooseCpuDraft} from './draft-ai.js?v=engine-360-r4';
import {isUtilityAfterimage,drawUtilityAfterimage,AFTERIMAGE_DURATION,teamFill} from './mobility-visual.js?v=engine-360-r4';
import {QuickClient,savedSession} from './quick-client.js?v=engine-360-r4';
import {renderMatchSummary} from './match-summary.js?v=2026-11-28-audio-411';
import {analyticsPreference,createPlayAnalytics} from './play-analytics.js?v=2026-11-28-audio-411';
import {loadGuest} from './guest-client.js?v=2026-11-28-audio-411';
import {attachRandom,saveSolo,loadSolo,clearSolo,recordSolo} from './solo-storage.js?v=2026-11-28-audio-411';
import {setupHistory} from './history-client.js?v=2026-11-28-audio-411';
import {loadSettings,renderProfile,arenaPoint,createFrameGate,createPerformanceAdvisor} from './performance-settings.js?v=2026-11-28-audio-411';
import {createSettingsUI} from './settings-ui.js?v=2026-11-28-audio-411';
import {createScreenWakeLock,shouldKeepAwake} from './wake-lock.js?v=2026-11-28-audio-411';
import {createStandeeRenderer} from './standee-renderer.js?v=2026-11-28-audio-411';
import {createAudioManager} from './audio-manager.js?v=2026-11-28-audio-411';
const $=id=>document.getElementById(id),canvas=$('arena'),ctx=canvas.getContext('2d');
const COLORS=['#64b3ff','#f58086','#f4d16f','#d3a2ff'];
let mode='solo',localSeat=0,online=null,onlineState=null,onlineObserved=0,onlineClock=null,replayDone=false,connectionMessage='';
let initialTypes=[],draftArchive=[],advancedOpen=false,effects=[],dotReadouts=new Map(),match=null,battle=null,chosen=null,frame=0,last=0,acc=0,paused=false,view='mode',lastResult=null,completedDraft=null,inspected=null;
let historyUI=null,settingsUI=null,settings=loadSettings(),profile=renderProfile(settings),frameTimer=null;
const frameGate=createFrameGate(),advisor=createPerformanceAdvisor();
const standees=createStandeeRenderer();let standeeActive=false;
const audio=createAudioManager({onStatus:message=>{const el=$('audioStatus');if(el)el.textContent=message;}});let audioPhase=null;
audio.configure(settings);
document.addEventListener?.('pointerup',()=>{audio.unlock();});
document.addEventListener?.('keydown',()=>{audio.unlock();});
document.addEventListener?.('click',()=>{audio.unlock();},true);
document.addEventListener?.('visibilitychange',()=>audio.visibility(document.hidden));
globalThis.addEventListener?.('pagehide',()=>audio.visibility(true));
globalThis.addEventListener?.('pageshow',()=>audio.visibility(document.hidden));
document.addEventListener?.('click',e=>{const b=e.target?.closest?.('button');if(b&&!b.disabled&&b.id!=='previewSound')audio.unlock().then(ok=>{if(ok)audio.play(b.id==='advance'?'confirm':'click');});},true);
const wakeLock=createScreenWakeLock({onStatus:state=>{$('wakeStatus').textContent=({active:'Screen is being kept awake.',idle:'Active during matches and matchmaking.',unsupported:'Screen wake lock is not supported by this browser.',unavailable:'Screen wake lock unavailable; your device sleep settings apply.'})[state];}});
function syncWake(retry=false){wakeLock.update(shouldKeepAwake({enabled:settings.keepAwake,hidden:document.hidden,phase:view,paused}),{retry});}
document.addEventListener?.('pointerdown',()=>syncWake(true));
globalThis.addEventListener?.('pagehide',()=>wakeLock.update(false));
globalThis.addEventListener?.('pageshow',()=>syncWake());
function applyGraphics(value){const changed=settings.preset!==value.preset||settings.theme!==value.theme||settings.reducedMotion!==value.reducedMotion;settings=value;audio.configure(value);if(!changed&&audioPhase!==null){syncWake();return;}profile=renderProfile(value);standeeActive=settings.theme==='standees'&&standees.available();if(standeeActive)standees.preview($('standeePreview'));$('standeePreview').hidden=!standeeActive;canvas.width=Math.round(720*profile.scale);canvas.height=Math.round(520*profile.scale);effects=[];dotReadouts.clear();frameGate.reset();advisor.reset();draw();syncWake();}
function stopFrame(){cancelAnimationFrame(frame);if(frameTimer!==null){clearTimeout(frameTimer);frameTimer=null;}frame=0;}
function scheduleFrame(){
 if(view!=='fight'||paused||replayDone||document.hidden)return;
 if(profile.fps===20&&typeof window!=='undefined'){
  frameTimer=setTimeout(()=>{frameTimer=null;loop(performance.now());},Math.max(0,50-(performance.now()-last)));
 }else frame=requestAnimationFrame(loop);
}
function restartFrame(){stopFrame();last=performance.now();frameGate.reset();advisor.reset();scheduleFrame();}
document.addEventListener?.('visibilitychange',()=>{syncWake();if(document.hidden)stopFrame();else if(view==='fight'){draw();restartFrame();}});
function checkpoint(){if(!online&&mode==='solo'&&match&&['draft','combat'].includes(match.phase))saveSolo(match,initialTypes,draftArchive);}
function resumeSolo(){const saved=loadSolo();if(!saved||view!=='mode')return;mode='solo';match=saved.match;initialTypes=saved.initialTypes;draftArchive=saved.draftArchive;view='draft';chosen=null;try{processBots();render();}catch{clearSolo();reset();$('historyStatus').textContent='Saved match could not be restored.';}}
const analytics=createPlayAnalytics();
analytics.enable(analyticsPreference());
const consent=$('playtestConsent');consent.checked=analyticsPreference();
consent.onchange=()=>analytics.enable(consent.checked);
document.addEventListener?.('visibilitychange',()=>analytics.visibility());
globalThis.addEventListener?.('pagehide',()=>analytics.flush());
if(typeof window!=='undefined'){setInterval(()=>analytics.flush(),60000);}
function syncAnalytics(){syncWake();analytics.update({phase:view,mode,playing:!!match&&match.players[localSeat]?.hp>0&&(view==='draft'||view==='results'||view==='fight'&&!paused)});}
function log(s){const d=document.createElement('div');d.textContent=s;$('log').prepend(d);while($('log').children.length>60)$('log').lastChild.remove()}
function button(text,detail,fn){const b=document.createElement('button');b.className='choice';const title=document.createElement('strong');title.textContent=text;const desc=document.createElement('span');desc.textContent=detail;b.append(title,desc);b.onclick=fn;return b}
function reset(){if(match&&mode==='solo')clearSolo();if(online)online.stop();online=null;onlineState=null;clearInterval(onlineClock);onlineClock=null;localSeat=0;mode='solo';connectionMessage='';replayDone=false;$('speed').disabled=false;$('fighterInfo').open=false;initialTypes=[];draftArchive=[];advancedOpen=false;$('resultHeadline').replaceChildren();$('roundSummary').replaceChildren();effects=[];dotReadouts.clear();stopFrame();match=null;battle=null;chosen=null;lastResult=null;completedDraft=null;inspected=null;view='mode';paused=false;acc=0;$('log').replaceChildren();$('results').textContent='Choose a starting chassis.';$('pause').disabled=true;$('step').disabled=true;$('pause').textContent='Pause';$('timer').textContent='0.0s';render();draw();historyUI?.refreshLocal();}
function playAgain(){if(view!=='over')return;const previousMode=mode,previousType=initialTypes[localSeat];reset();mode=previousMode;if(mode==='quick'&&Object.hasOwn(CHASSIS,previousType)){connectQuick(previousType);}else{view='start';render();}$('decision').scrollIntoView?.({block:'start',behavior:'instant'});}
function freshSeed(){if(globalThis.crypto?.getRandomValues){const values=new Uint32Array(1);globalThis.crypto.getRandomValues(values);return values[0]}return (Date.now()^Math.floor(Math.random()*0x100000000))>>>0}
function create(type){if(mode==='quick'){connectQuick(type);return;}$('roundSummary').replaceChildren();const seed=freshSeed(),random=rng(seed),bots=['bruiser','rogue','ranged'];for(let i=bots.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bots[i],bots[j]]=[bots[j],bots[i]]}initialTypes=[type,...bots];match=attachRandom(createMatch(initialTypes,seed));match.localMatchId=String(Date.now())+'-'+seed;draftPool(match);view='draft';chosen=null;log('Match seed: '+seed+' · Bot chassis: '+bots.join(', '));log('Match created. First draft precedes combat.');processBots();render()}
function processBots(){while(match.phase==='draft'&&match.draft.order[match.draft.turn]!==0){const index=match.draft.order[match.draft.turn],choice=chooseCpuDraft(match,index);assign(match,index,choice.card.uid,choice.chassisIndex,choice.passiveSlot,choice);log(match.players[index].name+' drafts '+choice.card.name)}checkpoint();if(match.phase==='combat')startCombat()}
function choose(card){chosen=card.uid;render()}
function takePick(){if(!chosen)return;const card=match.draft.pool.find(c=>c.uid===chosen);if(!card)return;const chassis=Number($('slot')?.value||0),passive=Number($('passiveSlot')?.value||0);if(online){if(onlineState?.turn!==localSeat)return;online.pick(card.uid,chassis,passive);return;}assign(match,0,card.uid,chassis,passive);match.draft.picks.at(-1).passiveSlot=passive;log('You draft '+card.name);chosen=null;processBots();render()}
function startCombat(){replayDone=false;$('fighterInfo').open=false;inspected=null;effects=[];dotReadouts.clear();battle=beginCombat(match);view='fight';last=performance.now();acc=0;paused=false;$('pause').disabled=!!online;$('step').disabled=!!online;$('speed').disabled=!!online;$('pause').textContent='Pause';log('Round '+match.round+' begins: '+battle.arena.name);renderInspector();restartFrame();render();requestAnimationFrame(()=>{if(view==='fight'){$('arena').scrollIntoView?.({block:'start',behavior:'instant'});}})}
function endCombat(){
 completedDraft=match.draft;const result=completeCombat(match,battle);showResult(result,completedDraft);
}
function showResult(result,draft){
 completedDraft=draft;if(!draftArchive.some(d=>d.originalPool[0]?.uid===draft.originalPool[0]?.uid))draftArchive.push(JSON.parse(JSON.stringify(draft)));lastResult=result;
 view=match.phase==='finished'?'over':'results';if(!online){if(view==='over'){recordSolo(match);clearSolo();}else checkpoint();}$('pause').disabled=true;$('step').disabled=true;
 const lines=result.ranking.map((i,rank)=>match.players[i].name+' #'+(rank+1)+' · -'+result.damage[i]+' HP'+(result.remaining[i]===0?' · Eliminated':''));
 $('results').replaceChildren();result.ranking.forEach((i,rank)=>{const row=document.createElement('div');row.className='placement-row';const name=document.createElement('strong');name.textContent='#'+(rank+1)+' '+match.players[i].name;name.style.color=COLORS[i];const hp=document.createElement('span');hp.textContent='−'+result.damage[i]+' HP · '+result.remaining[i]+' left';row.append(name,hp);$('results').append(row)});lines.forEach(log);const headline=$('resultHeadline');headline.replaceChildren();const placement=result.ranking.indexOf(localSeat);const h=document.createElement('strong');h.textContent=placement<0?'Spectating':(['1st','2nd','3rd','4th'][placement]+' place');const note=document.createElement('p');note.textContent='−'+result.damage[localSeat]+' match HP · '+result.remaining[localSeat]+' remaining';const reason=document.createElement('p');reason.className='muted';reason.textContent=result.time>=30-1e-6?'Time limit: surviving teams ranked by damage dealt, then remaining health.':'Combat ended with one or fewer surviving teams.';headline.append(h,note);if(result.time>=30-1e-6)headline.append(reason);
 const summary=$('roundSummary');summary.replaceChildren();
 const header=document.createElement('strong');header.textContent='Your squad · combat breakdown';summary.append(header);
 const own=result.combatReport.filter(u=>u.owner===localSeat);
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
   (u.bulwark?' · '+u.bulwark+' bulwark':'')+
   (u.followthrough?' · '+u.followthrough+' follow-through advances ('+fmt(u.followthroughDistance)+' units)':'');
  const bar=document.createElement('div');bar.className='damage-bar';const fill=document.createElement('i');fill.style.width=(100*u.damage/Math.max(1,...own.map(x=>x.damage)))+'%';bar.append(fill);row.append(heading,bar,values);
  const bonus=Object.entries(u.moduleDamage||{}).filter(([,damage])=>damage>0.05).sort((a,b)=>b[1]-a[1]);
  if(bonus.length){
   const detail=document.createElement('small');detail.className='muted';
   detail.textContent='Module damage: '+bonus.map(([name,value])=>name+' '+fmt(value)).join(' · ');
   row.append(detail);
  }
  const delivery=Object.entries(u.moduleHits||{}).filter(([,damage])=>damage>0.05).sort((a,b)=>b[1]-a[1]);
  if(delivery.length){
   const detail=document.createElement('small');detail.className='muted';
   detail.textContent='Delivery-enabled hits (overlapping): '+delivery.map(([name,value])=>name+' '+fmt(value)).join(' · ');
   row.append(detail);
  }
  summary.append(row);
 }
 const totals=document.createElement('div');totals.className='round-team-totals';
 totals.textContent='Team damage · '+match.players.map((player,index)=>{
  const amount=result.combatReport.filter(u=>u.owner===index).reduce((sum,u)=>sum+u.damage,0);
  return player.name+' '+fmt(amount);
 }).join(' · ');
 summary.append(totals);
 if(view==='over'){
  renderMatchSummary({headline,results:$('results'),summary,match,seat:localSeat,colors:COLORS,chassis:CHASSIS,onMenu:reset,onReplay:playAgain});
 }
 render();renderInspector();
 if(view==='over')$('resultsPanel').scrollIntoView?.({block:'start',behavior:'instant'});
}
function next(){if(online||view!=='results')return;view='draft';chosen=null;processBots();render()}
function render(){if(audioPhase!==view){if(audioPhase==='fight')audio.stop('combat');if(view==='fight')audio.play('start');else if((view==='results'||view==='over')&&audioPhase==='fight')audio.play('finish');audioPhase=view;}syncAnalytics();$('layout').setAttribute('data-phase',view);$('seedInfo').textContent=match?'Seed: '+match.seed+' · Starting fighters: '+initialTypes.join(', '):'Start a match to see reproducibility data.';$('exportMatch').disabled=!match;const root=$('choices');root.replaceChildren();$('round').textContent='Round '+(view==='results'&&lastResult?lastResult.round:match?.round||1);const phase=$('phaseTitle'),info=$('phaseInfo'),status=$('status'),advance=$('advance');advance.style.display='none';advance.disabled=true;
 if(view==='mode'){status.textContent='Choose mode';phase.textContent='Play';info.textContent='Choose how to play.';const solo=button('Solo','Instant match · three bots · untimed',()=>{mode='solo';view='start';render()}),quick=button('Quick Play','Find other players · 20s per draft turn',()=>{mode='quick';view='start';render()}),ranked=button('Ranked','Coming soon',null),options=button('Options','Graphics, sound, battery, history and privacy',()=>{view='options';render();historyUI?.refreshLocal();if($('historyPanel').open)historyUI?.refreshOnline()});ranked.disabled=true;for(const b of [solo,quick,ranked,options]){b.classList.add('mode-choice');root.append(b);}}
 if(view==='options'){status.textContent='Options';phase.textContent='Options';info.textContent='Manage device settings, saved matches and optional data sharing.';}
 if(view==='queue'){status.textContent='Quick Play';phase.textContent='Finding players';info.textContent=connectionMessage||'Joining the queue…';}
 if(view==='start'){status.textContent='Choose a chassis';phase.textContent='Choose your starting chassis';info.textContent=(mode==='quick'?'Choose your fighter before entering Quick Play. Up to two minutes to find players. ':'Choose a fighter, then draft one upgrade each round. ')+(connectionMessage||'Combat is automatic.');for(const [id,c] of Object.entries(CHASSIS))root.append(button(c.name,c.desc+' · HP '+c.hp+' · Damage '+c.damage,()=>create(id)))}
 if(view==='draft'||view==='fight'||view==='results'||view==='over'){const draft=view==='results'||view==='over'?completedDraft:match.draft;status.textContent='Shared draft';phase.textContent='Round '+match.round+' draft';info.textContent=view==='draft'?(online?(onlineState?.turn===localSeat?'Your turn · choose one upgrade.':'Waiting for '+(match.players[onlineState?.turn]?.name||'other players')+'.'):'Choose one upgrade.'):'Round picks';for(const card of draft.originalPool){
 const pick=draft.picks.find(p=>p.uid===card.uid);
 const available=draft.pool.some(p=>p.uid===card.uid);
 const allowed=view==='draft'&&available&&legal(match.players[localSeat],card)&&(!online||onlineState?.turn===localSeat);
 const b=button(card.name.replace(/^(Attack|Targeting|Utility|Morphology): /,''),cardSummary(card),()=>{if(allowed)choose(card)});b.setAttribute('data-kind',card.kind);const kind=document.createElement('small');kind.className='card-kind';kind.textContent=({attack:'Attack',target:'Targeting',utility:'Utility',passive:'Passive',morphology:'Morphology',unit:'Recruit'})[card.kind];b.append(kind);
 b.classList.add('draft-card');
 b.setAttribute('aria-pressed',String(chosen===card.uid));
 if(chosen===card.uid)b.classList.add('selected');
 if(!allowed){b.disabled=true;b.classList.add('unavailable')}
 if(pick){
  b.classList.add('claimed');
  const tag=document.createElement('sup');
  tag.className='draft-owner';
  tag.textContent=pick.player===localSeat?'You':match.players[pick.player].name;tag.style.color=COLORS[pick.player];b.setAttribute('data-owner',String(pick.player));
  b.append(tag);
  b.setAttribute('aria-label',card.name+', selected by '+(pick.player===localSeat?'you':match.players[pick.player].name));
 }else if(!legal(match.players[localSeat],card)&&view==='draft'){
  b.classList.add('squad-full');
  const tag=document.createElement('sup');
  tag.className='draft-owner';
  tag.textContent=card.kind==='unit'?'Full':'No slot';
  b.append(tag);
  b.setAttribute('aria-label',card.name+', squad full');
 }
 root.append(b)
}
const card=view==='draft'?draft.pool.find(c=>c.uid===chosen):null;if(card){const detail=document.createElement('div');detail.className='draft-detail';const heading=document.createElement('strong');heading.textContent=card.name;const body=document.createElement('p');body.textContent=cardDetail(card);detail.append(heading,body);root.append(detail)}if(card&&card.kind!=='unit'){
 const slot=document.createElement('select');slot.id='slot';
 match.players[localSeat].squad.forEach((u,i)=>{
  if(!canEquip(u,card))return;
  const opt=document.createElement('option');opt.value=i;
  opt.textContent='Attach to '+(i+1)+'. '+CHASSIS[u.type].name+
   (card.kind==='utility'&&u.passives.includes(card.key)?' · upgrade to 2 copies':'');
  slot.append(opt);
 });
 root.append(slot);
 if(card.kind==='passive'||card.kind==='utility'){
  const passive=document.createElement('select');passive.id='passiveSlot';
  const updateSlots=()=>{passive.replaceChildren();const u=match.players[localSeat].squad[Number(slot.value)||0];const upgrade=card.kind==='utility'&&u.passives.includes(card.key);for(let i=0;i<2;i++){const opt=document.createElement('option');opt.value=i;opt.textContent=upgrade?'Upgrade existing '+card.key:u.passives.length<2?'Use empty utility slot':'Replace '+u.passives[i];passive.append(opt)}passive.disabled=upgrade||u.passives.length<2;};slot.onchange=updateSlots;updateSlots();root.append(passive);
 }
}
if(view==='draft'){advance.style.display='';advance.disabled=!chosen||!!online&&onlineState?.turn!==localSeat;advance.textContent='Confirm pick'}}
 if(view==='fight'){status.textContent='Combat running';phase.textContent='Combat in progress';info.textContent='Round picks'}
 if(view==='results'){status.textContent='Round complete';phase.textContent='Round '+lastResult.round+' complete';info.textContent='';if(!online){advance.style.display='';advance.disabled=false;advance.textContent='Next draft'}else info.textContent='Next draft starts automatically.'}
 if(view==='over'){status.textContent='Match complete';phase.textContent='Match complete';info.textContent=match.players.find(p=>p.hp>0)?.name+' wins the match!'}
 $('restart').textContent=view==='queue'?'Cancel matchmaking':online?'Leave match':(view==='start'||view==='options')?'Back':'Restart match';const squad=$('squad');squad.replaceChildren();const heading=document.createElement('strong');heading.textContent='Your squad · '+(match?.players[localSeat].squad.length||0)+'/3';heading.style.color=COLORS[localSeat];squad.append(heading);for(const [i,u] of (match?.players[localSeat].squad||[]).entries()){const row=document.createElement('div');row.className='fighter';const name=document.createElement('strong');name.className='fighter-name';name.textContent=(i+1)+'. '+CHASSIS[u.type].name;row.append(name);const upgrades=u.modules.filter(m=>!m.passiveSlot&&m.kind!=='utility'&&m.kind!=='passive').map(m=>m.name.replace(/^(Attack|Targeting|Utility|Morphology): /,''));if(upgrades.length){const list=document.createElement('span');list.className='fighter-upgrades';list.textContent=' · '+upgrades.join(', ');row.append(list)}const slots=document.createElement('div');slots.className='fighter-slots';const label=document.createElement('span');label.className='slot-label';label.textContent='Utility';slots.append(label);for(let j=0;j<2;j++){const chip=document.createElement('span');const key=u.passives[j];chip.className='utility-slot'+(key?'':' empty');const module=u.modules.find(m=>m.passiveSlot===j+1);chip.textContent=key?(module?.name.replace(/^Utility: /,'')||key):'Empty';chip.setAttribute('aria-label','Utility slot '+(j+1)+': '+chip.textContent);slots.append(chip)}row.append(slots);squad.append(row)}renderStandings();renderDraftHistory();renderInspector()}
const LABELS={kill:'Kill Opportunity',damage:'Damage Opportunity',threat:'Threat',distance:'Target Distance',allyProximity:'Ally Proximity',safety:'Safety',protection:'Protection',ability:'Ability Readiness',isolation:'Isolation',preferredRange:'Preferred Range',coordinated:'Coordinated',independent:'Independent',opportunist:'Opportunist',pursuer:'Pursuer',challenger:'Challenger'};
const UTILITY_COOLDOWNS={dash:5,dodge:5,backstep:4.5,flank:4,intercept:5};
function selectFighter(owner,slot){$('fighterInfo').open=true;inspected={owner,slot};renderInspector();draw()}
function renderInspector(){
 const root=$('inspector');if(!root)return;
 root.replaceChildren();
 
 if(!match){const p=document.createElement('p');p.className='muted';p.textContent='Select a character during combat or between rounds.';root.append(p);return}
 const picker=document.createElement('div');picker.className='inspector-picker';
 match.players.forEach((p,owner)=>p.squad.forEach((ch,slot)=>{const btn=document.createElement('button');btn.className='secondary';btn.textContent=p.name+' · '+(slot+1)+' '+CHASSIS[ch.type].name;btn.style.color=COLORS[owner];btn.style.borderColor=COLORS[owner];btn.setAttribute('aria-pressed',String(inspected?.owner===owner&&inspected?.slot===slot));btn.onclick=()=>selectFighter(owner,slot);picker.append(btn)}));
 root.append(picker);
 if(!inspected)return;
 const player=match.players[inspected.owner],ch=player?.squad[inspected.slot];if(!ch)return;
 const live=(view==='fight'||view==='results'||view==='over')&&battle?.units.find(u=>u.owner===inspected.owner&&u.id%100===inspected.slot);
 const st=stats({type:ch.type,chassis:ch,squadSize:player.squad.length});
 let destination=root;const line=(title,value)=>{const row=document.createElement('div');row.className='inspector-line';const k=document.createElement('span');k.textContent=title;const v=document.createElement('strong');v.textContent=String(value);row.append(k,v);destination.append(row)};
 const section=title=>{const h=document.createElement('h3');h.textContent=title;destination.append(h)};
 const format=n=>Number(n).toFixed(2).replace(/\\.00$/,'');
 section(player.name+' · '+CHASSIS[ch.type].name+' #'+(inspected.slot+1));
 line('State',live?(live.hp>0?'Active':'Defeated'):'Between rounds / not deployed');
 line('Squad strength',Math.round((1-.15*(player.squad.length-1))*100)+'% base HP and damage ('+player.squad.length+' chassis)');
 line('Combat HP',live?format(live.hp)+' / '+format(live.maxHp):format(st.hp)+' maximum');
 line('Damage / Defense',format(st.damage)+' / '+st.defense);
 line('Attack range / interval',st.range+' / '+format(st.rate)+'s');
 line('Movement speed',format(st.speed));
 line('Size / radius',(morphologyTier(ch)>0?'+':'')+morphologyTier(ch)+' / '+format(st.radius));
 line('Attack lanes / pierce',st.projectiles+' / '+st.piercing);
 line('Attack modules',Object.entries(ch.mods).filter(([key,v])=>v>0&&!UTILITY_COOLDOWNS[key]&&['range','sunder','precision','expose','disruption','momentum','chain','burning','hazardous','restless','area','projectiles','piercing','knockback','taunt','velocity','rally','resonance','fortify','siphon','steadfast','patience','resolve','ricochet'].includes(key)).map(([key,v])=>key+' ×'+v).join(', ')||'None');
 line('Area / knockback / taunt',st.area+' / '+st.knockback+' / '+st.taunt);
 section('Draft upgrades');
 const mods=Object.entries(ch.mods).filter(([,v])=>v>0).map(([k,v])=>k+' ×'+v);
 line('Modules',mods.join(', ')||'None');
 line('Utility slots',ch.passives.join(', ')||'None');
 const preferences=METRICS.filter(k=>ch.weights[k]>0).sort((a,b)=>ch.weights[b]-ch.weights[a]);line('Tactical preferences',preferences.slice(0,3).map(k=>LABELS[k]||k).join(' · ')||'Default');
 const advanced=document.createElement('details');advanced.open=advancedOpen;advanced.ontoggle=()=>{advancedOpen=advanced.open};const summary=document.createElement('summary');summary.textContent='Advanced simulation data';advanced.append(summary);root.append(advanced);destination=advanced;
 section('AI weights · exact values');for(const key of METRICS)line(LABELS[key]||key,format(ch.weights[key]||0));
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
  if(live.disengageUntil>battle.time)line('Disengage retreat',format(live.disengageUntil-battle.time)+'s remaining');
  if(live.chassis.mods.followthrough)line('Follow Through impact cooldown',format(Math.max(0,(live.followthroughAt||0)-battle.time))+'s');
  for(const [key,seconds] of Object.entries(UTILITY_COOLDOWNS))if(st[key])line(key+' ×'+st[key],format(Math.max(0,(live.mobilityCd?.[key]||0)-battle.time))+'s remaining / '+seconds+'s base');
  if(live.evadingUntil>battle.time)line('Evading',format(live.evadingUntil-battle.time)+'s');
  if(live.phasingUntil>battle.time)line('Follow Through',format(live.phasingUntil-battle.time)+'s');
 }else if(battle&&view!=='fight'){const note=document.createElement('p');note.className='muted';note.textContent='Round complete. Configuration is current; the last combat state is shown when available.';root.append(note)}
}
function lineOfSight(a,b){const arena=battle?.arena;if(!arena)return true;return !arena.obstacles.some(o=>{const steps=24;for(let i=0;i<=steps;i++){const x=a.x+(b.x-a.x)*i/steps,y=a.y+(b.y-a.y)*i/steps;if(x>=o.x&&x<=o.x+o.w&&y>=o.y&&y<=o.y+o.h)return true}return false})}
canvas.addEventListener('click',event=>{
 if(!battle||!match)return;
 const {x,y}=arenaPoint(canvas.getBoundingClientRect(),event.clientX,event.clientY);
 let closest=null,d=Infinity;
 for(const u of battle.units){const r=radiusOf(u)+13,dist=Math.hypot(u.x-x,u.y-y);if(dist<=r&&dist<d){closest=u;d=dist}}
 if(closest)selectFighter(closest.owner,closest.id%100);
});
function renderDraftHistory(){const root=$('draftHistoryItems');root.replaceChildren();const draft=view==='results'||view==='over'?completedDraft:match?.draft;if(!draft)return;for(const card of draft.originalPool){const pick=draft.picks.find(p=>p.uid===card.uid),row=document.createElement('div');row.className='draft-history-row';const name=document.createElement('span');name.textContent=card.name;const owner=document.createElement('strong');owner.textContent=pick?match.players[pick.player].name:'Unpicked';if(pick)owner.style.color=COLORS[pick.player];row.append(name,owner);if(pick?.reasoning){const why=document.createElement('small');why.className='muted';why.textContent='Bot reasoning: '+pick.reasoning.reasons.join(' · ')+' (base '+pick.reasoning.baseScore+')';row.append(why)}root.append(row)}}
function renderStandings(){const root=$('standings');root.replaceChildren();for(const [i,p] of (match?.players||[]).entries()){const d=document.createElement('div');d.className='stand';const label=document.createElement('span');label.textContent=p.name+(p.hp===0?' · OUT':'');label.style.color=COLORS[i];d.style.borderTopColor=COLORS[i];d.setAttribute('data-owner',String(i));const value=document.createElement('span');value.textContent=p.hp+' HP';const bar=document.createElement('div');bar.className='match-hp-bar';const fill=document.createElement('i');fill.style.width=Math.max(0,p.hp)+'%';fill.style.background=COLORS[i];bar.append(fill);d.append(label,value,bar);if(online){const clock=document.createElement('span');clock.id='clock-'+i;clock.className='draft-clock';d.append(clock);}root.append(d)}updateOnlineClock()}
// Damage and impact animations are generated by authoritative combat events.
// Live projectiles are rendered directly from the engine, never faked as hitscan.
function collectEffects(){
 if(!battle)return;
 const now=battle.time;
 if(!document.hidden&&!paused&&Number($('speed').value||1)===1&&(!online||Math.floor((estimatedServerTime()-onlineState.startedAt)/(STEP*1000))-battle.tick<=3))audio.events(battle.visualEvents);
 for(const e of battle.visualEvents||[]){
  if(!profile.damageNumbers&&(e.kind==='dotDamage'||e.kind==='damage'))continue;
  if(!profile.afterimages&&e.kind==='mobility')continue;
  if(profile.fps===20&&e.kind==='wallImpact')continue;
  if(e.kind==='dotDamage'){
   // Gather fractional ticks per victim into readable, infrequent totals.
   const previous=dotReadouts.get(e.targetId);
   const entry=previous||{value:0,x:e.x,y:e.y,owner:e.owner,lastShown:now};
   entry.value+=e.value;entry.x=e.x;entry.y=e.y;
   dotReadouts.set(e.targetId,entry);
  }else if(e.kind==='damage')effects.push({...e,born:now,duration:1.1});
  else if(e.kind==='mobility')effects.push({...e,born:now,duration:isUtilityAfterimage(e)?AFTERIMAGE_DURATION:.3});
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
 if(effects.length>profile.effectLimit)effects=effects.slice(-profile.effectLimit);
}
function drawEffects(){
 if(!battle)return;
 const now=battle.time;
 effects=effects.filter(e=>now-e.born<e.duration);
 for(const e of effects){
  const t=Math.max(0,Math.min(1,(now-e.born)/e.duration));
  if(e.kind==='mobility'){
   if(isUtilityAfterimage(e)){if(!standeeActive||!standees.ghost(ctx,{...e,r:e.radius??CHASSIS[e.type]?.radius??11,color:COLORS[e.owner]},t))drawUtilityAfterimage(ctx,e,t,COLORS,CHASSIS);}
   else{
    // Follow Through retains its own continuous movement trace.
    ctx.save();ctx.globalAlpha=(1-t)*.7;ctx.strokeStyle=COLORS[e.owner];
    ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(e.x,e.y);
    ctx.lineTo(e.toX,e.toY);ctx.stroke();ctx.restore();
   }
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

function draw(){if(document.hidden)return;ctx.setTransform(profile.scale,0,0,profile.scale,0,0);if(!standeeActive||!standees.terrain(ctx,battle?.arena,profile.grid,profile.scale)){ctx.fillStyle='#19263a';ctx.fillRect(0,0,720,520);ctx.strokeStyle='#31415a';ctx.lineWidth=1;if(profile.grid){ctx.beginPath();for(let x=20;x<720;x+=40){ctx.moveTo(x,20);ctx.lineTo(x,500)}for(let y=20;y<520;y+=40){ctx.moveTo(20,y);ctx.lineTo(700,y)}ctx.stroke()}ctx.strokeStyle='#71829a';ctx.lineWidth=5;ctx.strokeRect(20,20,680,480);for(const o of battle?.arena?.obstacles||[]){ctx.fillStyle='#52617a';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.strokeStyle='#8b9bb2';ctx.strokeRect(o.x,o.y,o.w,o.h)}}for(const z of battle?.zones||[]){
 ctx.save();ctx.globalAlpha=Math.max(0,Math.min(.18,(z.until-battle.time)*.08));
 ctx.fillStyle='#f5a85d';ctx.beginPath();ctx.arc(z.x,z.y,z.radius,0,Math.PI*2);ctx.fill();
 ctx.restore();
}
 if(standeeActive){const pieces=(battle?.units||[]).filter(u=>u.hp>0).map(u=>({id:u.id,type:u.type,x:u.x,y:u.y,r:radiusOf(u),hp:u.hp,maxHp:u.maxHp,color:COLORS[u.owner],facing:u.facing,moving:Math.hypot(u.intent?.x||0,u.intent?.y||0)>.1,attackPhase:u.attack?.phase,local:u.owner===localSeat,selected:inspected?.owner===u.owner&&inspected?.slot===u.id%100})).sort((a,b)=>a.y-b.y||a.id-b.id);for(const p of pieces)standees.piece(ctx,p,battle.time,!settings.reducedMotion&&profile.fps>20);for(const p of pieces)standees.label(ctx,p);}else for(const u of battle?.units||[]){if(u.hp<=0)continue;const r=radiusOf(u);ctx.fillStyle=COLORS[u.owner];ctx.beginPath();ctx.arc(u.x,u.y,r+4,0,Math.PI*2);ctx.fill();if(inspected&&inspected.owner===u.owner&&inspected.slot===u.id%100){ctx.strokeStyle='#ffffff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(u.x,u.y,r+8,0,Math.PI*2);ctx.stroke();}if(u.owner===localSeat){ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(u.x,u.y,r+4,0,Math.PI*2);ctx.stroke();}ctx.fillStyle=teamFill(COLORS[u.owner]);ctx.beginPath();ctx.arc(u.x,u.y,r-1,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0b1625';ctx.textAlign='center';ctx.font='bold '+Math.round(16*(1+.12*morphologyTier(u)))+'px system-ui';ctx.fillText(u.type==='bruiser'?'B':u.type==='rogue'?'R':'A',u.x,u.y+4);ctx.fillStyle='#102033';ctx.fillRect(u.x-17,u.y-r-17,34,6);ctx.fillStyle='#77e7a3';ctx.fillRect(u.x-17,u.y-r-17,34*u.hp/u.maxHp,6)}drawEffects()}
function step(){if(view!=='fight'||replayDone)return;const result=tick(battle,STEP);collectEffects();for(const event of battle.events.splice(0))log(event);if(result!==null){$('timer').textContent=battle.time.toFixed(1)+'s';}if(result!==null){if(online)replayDone=true;else endCombat();}else if($('fighterInfo').open&&inspected&&battle.tick%6===0)renderInspector()}
function loop(now){if(document.hidden||view!=='fight'||paused||replayDone)return;const elapsed=Math.max(0,now-last),dt=Math.min(.08,elapsed/1000),workStart=performance.now();last=now;if(view==='fight'&&!paused&&!replayDone){if(online){const target=Math.max(0,Math.floor((estimatedServerTime()-onlineState.startedAt)/(STEP*1000)));let count=0;while(battle.tick<target&&count++<30&&!replayDone&&view==='fight')step();}else{acc+=dt*Number($('speed').value||1);let count=0;while(acc>=STEP&&count++<12&&view==='fight'){step();acc-=STEP}}}if(view!=='fight'||replayDone||frameGate.due(now,profile.fps)){$('timer').textContent=battle.time.toFixed(1)+'s';draw();}if(view==='fight'&&!replayDone){if(settingsUI&&Number($('speed').value||1)===1)settingsUI.recommend(advisor.observe({elapsed,work:performance.now()-workStart,fps:profile.fps,preset:settings.preset}));scheduleFrame();}}
$('exportMatch').onclick=()=>{if(!match)return;const data={version:'4.1.1',seed:match.seed,initialTypes,drafts:draftArchive, currentDraft:view==='draft'||view==='fight'?match.draft:null,results:match.history,players:match.players};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='autobattler-'+match.seed+'.json';link.click();URL.revokeObjectURL(url);};$('advance').onclick=()=>view==='draft'?takePick():next();$('restart').onclick=reset;$('pause').onclick=()=>{if(online)return;paused=!paused;$('pause').textContent=paused?'Resume':'Pause';last=performance.now();syncAnalytics();if(paused){audio.stop('combat');stopFrame();}else restartFrame()};$('step').onclick=()=>{if(online)return;paused=true;audio.stop('combat');stopFrame();syncAnalytics();$('pause').textContent='Resume';step();if(battle)$('timer').textContent=battle.time.toFixed(1)+'s';draw()};applyGraphics(settings);reset();if(typeof window!=='undefined'){historyUI=setupHistory({resume:resumeSolo});settingsUI=createSettingsUI({onChange:applyGraphics,onPreview:()=>audio.preview()});}const resumeToken=savedSession();if(typeof window!=='undefined'){loadGuest().then(p=>{$('guestName').textContent=p.name+' · Guest';if(resumeToken&&view==='mode')connectQuick(null,resumeToken);}).catch(()=>{$('guestName').textContent='Local guest · Solo available';});}else if(resumeToken)connectQuick(null,resumeToken);

function estimatedServerTime(){return (onlineState?.serverNow||0)+Math.max(0,performance.now()-onlineObserved);}
function updateOnlineClock(){
 if(!online||!onlineState)return;
 if(view==='queue'&&onlineState.status==='queued'){
  const seconds=Math.max(0,Math.ceil((onlineState.queueDeadline-estimatedServerTime())/1000));
  $('phaseInfo').textContent=connectionMessage||onlineState.queueCount+'/4 players · '+seconds+'s maximum remaining';return;
 }
 if(connectionMessage&&view==='draft')$('phaseInfo').textContent=connectionMessage;
 for(let i=0;i<4;i++){
  const el=document.getElementById('clock-'+i);if(!el)continue;
  let ms=onlineState.clocks?.[i];
  if(ms===null||ms===undefined){el.textContent='Bot';continue;}
  if(onlineState.phase==='draft'&&onlineState.turn===i)ms=Math.max(0,ms-Math.max(0,performance.now()-onlineObserved));
  el.textContent=(ms/1000).toFixed(1)+'s';const missed=onlineState.missed?.[i]||0;el.title=missed?missed+' consecutive missed picks · next manual pick restores 20s':'20 seconds per turn';el.style.color=onlineState.turn===i?'#f4d16f':'#a4b5ce';
 }
}
function connectQuick(type,resume=null){
 if(online)online.stop();mode='quick';view='queue';connectionMessage='';render();
 const client=new QuickClient({onState:s=>{
  if(online!==client)return;
  const previous=onlineState,hadError=!!connectionMessage;onlineState=s;onlineObserved=performance.now();connectionMessage='';
  if(s.status==='queued'){if(view!=='queue'){view='queue';render();}updateOnlineClock();return;}
  if(!s.match){if(hadError&&view==='draft')$('phaseInfo').textContent=s.turn===localSeat?'Your turn · choose one upgrade.':'Waiting for '+(match.players[s.turn]?.name||'other players')+'.';updateOnlineClock();return;}
  localSeat=s.seat;initialTypes=s.types;const oldView=view;match=s.match;
  match.players[localSeat].name='You';
  if(s.phase==='draft'){
   stopFrame();battle=null;view='draft';if(previous?.revision!==s.revision)chosen=null;render();draw();
  }else if(s.phase==='combat'){
   if(oldView!=='fight'||previous?.startedAt!==s.startedAt){chosen=null;startCombat();}
  }else if(s.phase==='results'||s.phase==='finished'){
   stopFrame();chosen=null;if(oldView!=='fight')battle=null;showResult(s.result,s.completedDraft);draw();
  }
  updateOnlineClock();
 },onError:(error,terminal)=>{
  if(online!==client)return;connectionMessage=error.message||'Connection interrupted; reconnecting…';
  if(terminal){online=null;onlineState=null;clearInterval(onlineClock);view='start';match=null;localSeat=0;render();draw();}
  else{$('phaseInfo').textContent=connectionMessage;}
 }});
 online=client;onlineClock=setInterval(updateOnlineClock,100);if(resume)client.resume(resume);else loadGuest().then(p=>{if(online!==client)return;$('guestName').textContent=p.name+' · Guest';client.start(type);}).catch(e=>{if(online===client)client.onError?.(e,true);});
}
