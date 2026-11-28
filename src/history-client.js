import {loadGuest} from './guest-client.js?v=2026-11-28-performance-390';
import {soloHistory,soloHistoryEnabled,setSoloHistory,loadSolo,clearSolo} from './solo-storage.js?v=2026-11-28-performance-390';
async function request(enabled){
 await loadGuest();
 const res=await fetch('./api/history',{method:enabled===undefined?'GET':'POST',...(enabled===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled})}),cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!res.ok)throw Error('Online history unavailable');return res.json();
}
export function setupHistory({resume}){
 const $=id=>document.getElementById(id),local=$('soloHistoryConsent'),online=$('quickHistoryConsent'),message=$('historyStatus');
 const line=(parent,text)=>{const p=document.createElement('div');p.textContent=text;parent.append(p);};
 function rows(parent,items){parent.replaceChildren();if(!items.length){line(parent,'No saved matches.');return;}for(const x of items){const date=new Date(x.completed_at);line(parent,date.toLocaleDateString()+' · #'+x.placement+' · '+x.rounds+' rounds · '+Math.round(x.damage)+' dealt');}}
 function refreshLocal(){local.checked=soloHistoryEnabled();rows($('soloHistoryRows'),soloHistory());const saved=loadSolo();$('resumeSolo').hidden=!saved;$('discardSolo').hidden=!saved;}
 function showOnline(data){online.checked=data.enabled;rows($('quickHistoryRows'),data.history);$('quickHistoryTotals').textContent=data.enabled?data.totals.matches+' lifetime matches · '+data.totals.wins+' wins · '+data.totals.rounds+' rounds':'History off';}
 local.onchange=()=>{if(!setSoloHistory(local.checked))message.textContent='Local storage unavailable.';refreshLocal();};
 $('resumeSolo').onclick=resume;$('discardSolo').onclick=()=>{clearSolo();refreshLocal();};
 online.disabled=true;online.onchange=async()=>{const desired=online.checked;online.disabled=true;try{showOnline(await request(desired));message.textContent=desired?'Online history enabled for future matches.':'Online history deleted.';}catch{online.checked=!desired;message.textContent='Could not change online history.';}finally{online.disabled=false;}};
 async function refreshOnline(){online.disabled=true;try{showOnline(await request());online.disabled=false;message.textContent='';}catch{message.textContent='Online history unavailable; Solo still works.';}}
 $('historyPanel').ontoggle=()=>{if($('historyPanel').open)refreshOnline();};
 refreshLocal();return {refreshLocal,refreshOnline};
}
