import {rng,CHASSIS} from './simulation.js?v=engine-360-r4';
import {summarizeMatch} from './match-summary.js?v=2026-11-28-requeue-394';
const SAVE='ab-solo-checkpoint-v1',HISTORY='ab-solo-history-v1',OPT='ab-solo-history-opt-v1';
const RULES='engine-360-r4';
const get=k=>{try{return localStorage.getItem(k);}catch{return null;}};
const set=(k,v)=>{try{localStorage.setItem(k,v);return true;}catch{return false;}};
const del=k=>{try{localStorage.removeItem(k);}catch{}};
export function attachRandom(match,calls=0){
 const next=rng(match.seed);for(let i=0;i<calls;i++)next();
 match.randomCalls=calls;match.random=()=>{match.randomCalls++;return next();};return match;
}
export function makeCheckpoint(match,initialTypes,draftArchive){
 return JSON.stringify({rules:RULES,match,initialTypes,draftArchive});
}
export function parseCheckpoint(raw){
 if(typeof raw!=='string'||raw.length>1000000)return null;
 try{
  const v=JSON.parse(raw),m=v.match;
  if(v.rules!==RULES||!m||!Number.isInteger(m.seed)||m.seed<0||m.seed>0xffffffff||!Number.isInteger(m.randomCalls)||m.randomCalls<0||m.randomCalls>50000||!Number.isInteger(m.round)||m.round<1||m.round>250||!['draft','combat'].includes(m.phase)||m.players?.length!==4||!Array.isArray(m.history)||m.history.length>250||!Array.isArray(v.draftArchive)||!Array.isArray(v.initialTypes)||v.initialTypes.length!==4||!v.initialTypes.every(t=>Object.hasOwn(CHASSIS,t))||!Array.isArray(m.draft?.pool)||!Array.isArray(m.draft?.order)||!m.players.every(p=>Number.isFinite(p.hp)&&Array.isArray(p.squad)&&p.squad.length>=1&&p.squad.length<=3&&p.squad.every(u=>Object.hasOwn(CHASSIS,u.type))))return null;
  return {...v,match:attachRandom(m,m.randomCalls)};
 }catch{return null;}
}
export function saveSolo(match,types,archive){try{const data=makeCheckpoint(match,types,archive);return data.length<=1000000&&set(SAVE,data);}catch{return false;}}
export function loadSolo(){return parseCheckpoint(get(SAVE));}
export function clearSolo(){del(SAVE);}
export function soloHistoryEnabled(){return get(OPT)==='yes';}
export function setSoloHistory(enabled){if(!enabled){del(HISTORY);del(OPT);return true;}return set(OPT,'yes');}
export function soloHistory(){try{const h=JSON.parse(get(HISTORY)||'[]');return Array.isArray(h)?h.slice(0,100):[];}catch{return [];}}
export function recordSolo(match){
 if(!soloHistoryEnabled()||match.phase!=='finished')return;
 const s=summarizeMatch(match,0),h=soloHistory(),id=match.localMatchId;
 if(h.some(x=>x.id===id))return;
 h.unshift({id,completed_at:Date.now(),placement:s.placement,rounds:s.rounds,round_wins:s.wins,damage:s.totals.damage,prevented:s.totals.prevented});
 set(HISTORY,JSON.stringify(h.slice(0,100)));
}
