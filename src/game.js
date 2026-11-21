import {CHASSIS as TYPES,ARENAS,spawn,stats,bound,tick as simTick,placementGroups,resolvePlayerHP,placementDamage,makeChassis,teamPercent} from './simulation.js';
const $=id=>document.getElementById(id);
const canvas=$('arena'),ctx=canvas.getContext('2d');
const TEAM=['#64b3ff','#f58086','#f4d16f','#d3a2ff'];
const SPAWNS=[[110,100],[610,100],[610,420],[110,420]];
const ATTACKS=[
 {id:'damage',name:'Sharpened',desc:'+4 attack damage'},
 {id:'rate',name:'Rapid Strike',desc:'15% increased attack frequency'},
 {id:'range',name:'Reach',desc:'+20 attack range'},
 {id:'projectiles',name:'Multishot',desc:'+1 attack projectile / melee swing'},
 {id:'piercing',name:'Piercing',desc:'+1 additional target per attack'},
 {id:'area',name:'Wide Attack',desc:'Wider attack area'},
 {id:'knockback',name:'Impact',desc:'Adds knockback'},
 {id:'speed',name:'Fleet',desc:'+18 movement speed'},
 {id:'hp',name:'Reinforcement',desc:'+30 chassis maximum HP'}
];
const TARGETS=[
 {id:'executioner',name:'Executioner',desc:'+Kill Opportunity',weights:{kill:1}},
 {id:'guardian',name:'Guardian',desc:'+Ally Protection',weights:{protection:1}},
 {id:'skirmisher',name:'Skirmisher',desc:'+Preferred Range',weights:{preferredRange:1}},
 {id:'coward',name:'Coward',desc:'+Personal Safety',weights:{safety:1}},
 {id:'duelist',name:'Duelist',desc:'+Target Isolation',weights:{isolation:1}},
 {id:'hunter',name:'Hunter',desc:'+Target Distance',weights:{distance:1}},
 {id:'aggressor',name:'Aggressor',desc:'+Damage Opportunity',weights:{damage:1}}
];
const PASSIVES=[
 {id:'regen',name:'Regeneration',desc:'Slowly restore health during combat'},
 {id:'bulwark',name:'Bulwark',desc:'Reduce incoming attack damage'},
 {id:'haste',name:'Haste',desc:'Increased movement speed'},
 {id:'focus',name:'Focus',desc:'Attack faster while healthy'}
];
let state,chosen=null,offer=[],paused=false,frame=0,last=0,acc=0,seed=12345;
function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
function pick(list){return list[Math.floor(rnd()*list.length)]}
function log(s){const d=document.createElement('div');d.textContent=s;$('log').prepend(d);while($('log').children.length>60)$('log').lastChild.remove()}
function player(i){return state.players[i]}
function initialize(){cancelAnimationFrame(frame);seed=12345;state={phase:'start',round:1,time:0,events:[],players:TEAM.map((color,i)=>({name:i?'Bot '+i:'You',color,hp:100,squad:[],streak:0})),units:[],roundResults:[],draftOrder:[],draftIndex:0,arena:ARENAS[0]};chosen=null;offer=[];paused=false;acc=0;$('log').replaceChildren();$('results').textContent='Choose your starting chassis.';$('pause').disabled=true;$('step').disabled=true;$('pause').textContent='Pause';$('timer').textContent='0.0s';$('round').textContent='Round 1';renderDraft();renderStandings();draw()}
function option(id,name,desc,extra=''){const b=document.createElement('button');b.className='choice'+(chosen===id?' selected':'');const strong=document.createElement('strong');strong.textContent=name;const span=document.createElement('span');span.textContent=desc;b.append(strong,span);if(extra){const em=document.createElement('em');em.textContent=extra;b.append(em)}b.onclick=()=>{chosen=id;renderDraft()};return b}
function draftCatalog(){return [...Object.keys(TYPES).map(id=>({id:'unit:'+id,name:'Recruit '+TYPES[id].name,desc:'Add a '+TYPES[id].name+' chassis',kind:'unit'})),...ATTACKS.map(x=>({...x,id:'attack:'+x.id,kind:'attack'})),...TARGETS.map(x=>({...x,id:'target:'+x.id,kind:'target'})),...PASSIVES.map(x=>({...x,id:'passive:'+x.id,kind:'passive'}))]}
function buildOffer(){const active=state.players.map((p,i)=>p.hp>0?i:-1).filter(i=>i>=0);const catalog=draftCatalog();offer=[];for(let i=0;i<active.length+2;i++)offer.push({...pick(catalog),uid:'draft-'+state.round+'-'+i});const full=active.filter(i=>player(i).squad.length===3).length;let legalCount=offer.filter(x=>x.kind!=='unit').length;for(let i=offer.length-1;i>=0&&legalCount<full;i--)if(offer[i].kind==='unit'){offer[i]={...pick(catalog.filter(x=>x.kind!=='unit')),uid:offer[i].uid};legalCount++}state.draftOrder=state.round===1?[0,1,2,3].filter(i=>player(i).hp>0):state.roundResults.filter(i=>player(i).hp>0).reverse();state.draftIndex=0;state.phase='draft';chosen=null;processCpuTurns();renderDraft()}
function processCpuTurns(){while(state.draftIndex<state.draftOrder.length&&state.draftOrder[state.draftIndex]!==0){const i=state.draftOrder[state.draftIndex],p=player(i);const options=offer.filter(x=>legal(p,x));if(!options.length)throw Error('Draft has no legal options for '+p.name);const recruits=options.filter(x=>x.kind==='unit');const other=options.filter(x=>x.kind!=='unit');const choice=recruits.length&&p.squad.length<3&&rnd()<.45?pick(recruits):pick(other.length?other:options);applyPick(p,choice,Math.floor(rnd()*p.squad.length));offer.splice(offer.indexOf(choice),1);log(p.name+' drafts '+choice.name);state.draftIndex++}if(state.draftIndex>=state.draftOrder.length){log('Draft complete; '+offer.length+' options discarded');startRound()}}
function renderDraft(){const root=$('choices');root.replaceChildren();const p=player(0);$('round').textContent='Round '+state.round;
 if(state.phase==='start'){$('status').textContent='Choose a chassis';$('phaseTitle').textContent='Choose your starting chassis';$('phaseInfo').textContent='Your first fighter is free. You will draft an upgrade before the first battle.';for(const [id,t] of Object.entries(TYPES))root.append(option(id,t.name,t.desc,'HP '+t.hp+' · ATK '+t.damage))}
 if(state.phase==='draft'){$('status').textContent='Draft phase';$('phaseTitle').textContent='Round '+state.round+' draft';$('phaseInfo').textContent='Shared pool: '+offer.length+' options remaining. Pick '+(state.draftIndex+1)+' of '+state.draftOrder.length+'. Your builds persist.';for(const x of offer){if(x.kind==='unit'&&p.squad.length>=3)continue;root.append(option(x.uid,x.name,x.desc,x.kind==='unit'?'New chassis':x.kind==='target'?'Targeting module':x.kind==='passive'?'Passive module':'Attack mutation'))}if(chosen){const selected=offer.find(x=>x.uid===chosen);if(selected&&selected.kind!=='unit'){const select=document.createElement('select');select.id='slot';p.squad.forEach((u,i)=>{const o=document.createElement('option');o.value=i;o.textContent='Attach to '+(i+1)+'. '+TYPES[u.type].name;select.append(o)});root.append(select);if(selected.kind==='passive'){const slots=document.createElement('select');slots.id='passiveSlot';for(let i=0;i<2;i++){const o=document.createElement('option');o.value=i;o.textContent='Passive slot '+(i+1);slots.append(o)}root.append(slots)}}}}
 if(state.phase==='fight'){$('status').textContent='Combat running';$('phaseTitle').textContent='Combat in progress';$('phaseInfo').textContent='Watch the teams fight. Combat is automatic.'}
 if(state.phase==='results'){$('status').textContent='Round complete';$('phaseTitle').textContent='Round '+state.round+' complete';$('phaseInfo').textContent='Review the results, then continue to the next draft.'}
 if(state.phase==='over'){$('status').textContent='Match complete';$('phaseTitle').textContent='Match complete';$('phaseInfo').textContent=state.players.find(x=>x.hp>0)?.name+' wins the match!'}
 const btn=$('advance');btn.disabled=state.phase==='fight'||state.phase==='over'||((state.phase==='start'||state.phase==='draft')&&!chosen);btn.textContent=state.phase==='start'?'Confirm chassis':state.phase==='draft'?'Confirm draft pick':state.phase==='results'?'Next draft':'Combat in progress';
 const squad=$('squad');squad.replaceChildren();const title=document.createElement('strong');title.textContent='Your build · '+p.squad.length+' fighters';squad.append(title);p.squad.forEach((u,i)=>{const d=document.createElement('div');d.className='fighter';d.textContent=(i+1)+'. '+TYPES[u.type].name+' · '+u.modules.map(m=>m.name).join(', ');squad.append(d)})}
function legal(p,x){return x.kind!=='unit'||p.squad.length<3}
function applyPick(p,x,slot=0,passiveSlot=0){if(!legal(p,x))return false;if(x.kind==='unit'){p.squad.push(makeChassis(x.id.slice(5)));return true}const u=p.squad[Math.max(0,Math.min(p.squad.length-1,slot))];if(!u)return false;if(x.kind==='target'){const module=TARGETS.find(t=>t.id===x.id.slice(7));for(const [k,v] of Object.entries(module.weights))u.weights[k]+=v;u.modules.push({name:x.name})}else if(x.kind==='passive'){if(u.passives.length<2)u.passives.push(x.id.slice(8));else u.passives[Math.max(0,Math.min(1,passiveSlot))]=x.id.slice(8);u.modules=u.modules.filter(m=>!m.passiveSlot||m.passiveSlot!==passiveSlot+1);u.modules.push({name:x.name,passiveSlot:passiveSlot+1})}else{const key=x.id.slice(7);u.mods[key]++;u.modules.push({name:x.name})}return true}
function startRound(){state.arena=ARENAS[(state.round-1)%ARENAS.length];const battle=spawn(state.players,state.arena,12345+state.round*991);Object.assign(state,{phase:'fight',time:0,units:battle.units,eliminations:[],tick:0,events:[],random:battle.random});$('results').textContent='Round '+state.round+' · '+state.arena.name;$('pause').disabled=false;$('step').disabled=false;paused=false;acc=0;last=performance.now();log('Round '+state.round+' begins');renderDraft();cancelAnimationFrame(frame);frame=requestAnimationFrame(loop)}
function tick(dt){const result=simTick(state,dt);for(const event of state.events.splice(0))log(event);if(result!==null)finishRound()}
function runTie(a,b){const participants=state.players.map((p,i)=>({...p,hp:i===a||i===b?100:0}));const sim=spawn(participants,state.arena,9917+state.round*23+a*11+b);for(let n=0;n<900;n++){if(simTick(sim,1/30)!==null)break}const pa=teamPercent(sim,a),pb=teamPercent(sim,b);return pa!==pb?pa>pb?a:b:a<b?a:b}
function resolveGroups(groups){const ranking=[];for(const group of groups){if(group.length===1){ranking.push(group[0]);continue}const wins=new Map(group.map(i=>[i,0]));for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){const winner=runTie(group[i],group[j]);wins.set(winner,wins.get(winner)+1)}ranking.push(...[...group].sort((a,b)=>wins.get(b)-wins.get(a)||a-b))}return ranking}
function finishRound(){const ranking=resolveGroups(placementGroups(state));state.roundResults=ranking;resolvePlayerHP(state.players,ranking,state.round);const lines=ranking.map((id,index)=>{const p=player(id);const damage=index===0?0:placementDamage(state.round,index+1,ranking.length,index>=ranking.length-Math.floor(ranking.length/2)?p.streak-1:0);return p.name+' #'+(index+1)+(damage?' −'+damage+' HP':' WIN')+(p.hp===0?' · Eliminated':'')});$('results').textContent=lines.join(' | ');for(const line of lines)log(line);renderStandings();$('pause').disabled=true;$('step').disabled=true;state.phase=state.players.filter(p=>p.hp>0).length<=1?'over':'results';renderDraft()}
;