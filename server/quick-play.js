import {randomBytes} from 'node:crypto';
import {createMatch,draftPool,assign,legal,canEquip,beginCombat,completeCombat} from '../src/headless.js';
import {CHASSIS,STEP,tick,rng} from '../src/simulation.js';
import {chooseCpuDraft} from '../src/draft-ai.js';

export const RULES=Object.freeze({queueMs:120000,initialMs:20000,incrementMs:4000,capMs:30000,resultMs:3000,queueLeaseMs:20000,finishedMs:600000,abandonedMs:120000,maxSessions:256,maxMatches:16});
export class QuickError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new QuickError(status,message);};
const copy=x=>structuredClone(x);
const token=()=>randomBytes(32).toString('hex');
const seed=()=>randomBytes(4).readUInt32LE();
const publicMatch=m=>({seed:m.seed,round:m.round,phase:m.phase,players:copy(m.players),lastRanking:[...m.lastRanking],lastSpawnSlots:m.lastSpawnSlots?.slice()||null,draft:copy(m.draft),history:copy(m.history)});

export function createQuickPlay({now=Date.now,makeSeed=seed,makeToken=token,rules=RULES}={}){
 const sessions=new Map(),games=new Map(),queue=[];
 let queueDeadline=null;
 function removeQueued(s){const i=queue.indexOf(s);if(i>=0)queue.splice(i,1);if(!queue.length)queueDeadline=null;}
 function authenticate(id){const s=sessions.get(id);if(!s||s.left)fail(401,'Session expired');return s;}
 function activeSeat(g){return g.match.phase==='draft'?g.match.draft.order[g.match.draft.turn]:null;}
 function charge(g,seat,t){g.banks[seat]=Math.max(0,g.banks[seat]-Math.max(0,t-g.turnStart));}
 function increment(g,seat){if(g.humans[seat])g.banks[seat]=Math.min(rules.capMs,g.banks[seat]+rules.incrementMs);}
 function botPick(g,seat,t){
  const human=g.humans[seat];
  if(human){charge(g,seat,t);if(!human.left)g.banks[seat]=0;}
  const p=chooseCpuDraft(g.match,seat);
  assign(g.match,seat,p.card.uid,p.chassisIndex,p.passiveSlot,p);
  g.match.draft.picks.at(-1).passiveSlot=p.passiveSlot;
  g.match.draft.picks.at(-1).automatic=true;
  increment(g,seat);g.revision++;g.turnStart=null;
 }
 function startFight(g){
  g.replay=publicMatch(g.match);g.battle=beginCombat(g.match);
  let done=null;
  for(let i=0;i<900;i++){done=tick(g.battle,STEP);if(done!==null)break;}
  if(done===null)throw Error('Round exceeded tick limit');
  g.phase='combat';g.startedAt=now();g.deadline=g.startedAt+Math.round(g.battle.time*1000);
  g.turnStart=null;g.revision++;
 }
 function advanceDraft(g,t){
  while(g.match.phase==='draft'){
   const seat=activeSeat(g),human=g.humans[seat];
   if(!human){g.turnStart=t;botPick(g,seat,t);continue;}
   if(g.turnStart===null)g.turnStart=t;
   if(human.left||t>=g.turnStart+g.banks[seat]){botPick(g,seat,t);continue;}
   return;
  }
  if(g.match.phase==='combat')startFight(g);
 }
 function createGame(group,t){
  const id=makeToken(),s=makeSeed()>>>0,random=rng(s),types=group.map(p=>p.type);
  while(types.length<4)types.push(Object.keys(CHASSIS)[Math.floor(random()*3)]);
  const m=createMatch(types,s),humans=Array.from({length:4},(_,i)=>group[i]||null);
  m.players.forEach((p,i)=>{p.name=humans[i]?'Player '+(i+1):'Bot '+(i+1);});
  const g={id,match:m,humans,types,banks:humans.map(x=>x?rules.initialMs:null),phase:'draft',revision:1,turnStart:null,deadline:null,startedAt:null,replay:null,battle:null,completedDraft:null,result:null,finishedAt:null};
  games.set(id,g);
  group.forEach((p,i)=>{p.game=id;p.seat=i;});
  draftPool(m);advanceDraft(g,t);return g;
 }
 function pump(){
  const t=now();
  for(const s of [...queue])if(s.left||t-s.lastSeen>=rules.queueLeaseMs){removeQueued(s);sessions.delete(s.id);}
  while(queue.length&&games.size<rules.maxMatches&&(queue.length>=4||t>=queueDeadline)){
   const group=queue.splice(0,4);queueDeadline=queue.length?queue[0].joined+rules.queueMs:null;
   createGame(group,t);
  }
  for(const [id,g] of games){
   if(g.humans.every(s=>!s||s.left||t-s.lastSeen>=rules.abandonedMs)||(g.finishedAt!==null&&t-g.finishedAt>=rules.finishedMs)){
    games.delete(id);for(const s of g.humans)if(s)sessions.delete(s.id);continue;
   }
   if(g.phase==='draft')advanceDraft(g,t);
   else if(g.phase==='combat'&&t>=g.deadline){
    g.completedDraft=copy(g.match.draft);g.result=completeCombat(g.match,g.battle);g.battle=null;g.replay=null;
    g.phase=g.match.phase==='finished'?'finished':'results';g.deadline=t+rules.resultMs;g.revision++;
    if(g.phase==='finished')g.finishedAt=t;
   }else if(g.phase==='results'&&t>=g.deadline){
    g.phase='draft';g.turnStart=null;g.revision++;advanceDraft(g,t);
   }
  }
 }
 function state(s,revision){
  const t=now();
  if(!s.game)return {status:'queued',serverNow:t,queueCount:queue.length,queueDeadline};
  const g=games.get(s.game);if(!g)fail(401,'Match expired');
  const seat=activeSeat(g),turn=g.phase==='draft'?seat:null;
  const clocks=g.banks.map((v,i)=>v===null?null:Math.max(0,v-(i===turn&&g.turnStart!==null?Math.max(0,t-g.turnStart):0)));
  const out={status:'matched',revision:g.revision,seat:s.seat,phase:g.phase,serverNow:t,turn,clocks,deadline:g.phase==='draft'&&turn!==null?g.turnStart+g.banks[turn]:g.deadline,startedAt:g.startedAt,humans:g.humans.map(x=>Boolean(x&&!x.left))};
  if(revision!==g.revision)Object.assign(out,{match:g.phase==='combat'?copy(g.replay):publicMatch(g.match),types:[...g.types],completedDraft:copy(g.completedDraft),result:copy(g.result)});
  return out;
 }
 function join(type){
  if(!Object.hasOwn(CHASSIS,type))fail(400,'Unknown starting chassis');
  pump();
  if(sessions.size>=rules.maxSessions||games.size>=rules.maxMatches)fail(503,'Quick Play is busy');
  const t=now(),id=makeToken(),s={id,type,joined:t,lastSeen:t,game:null,seat:null,left:false};
  sessions.set(id,s);if(!queue.length)queueDeadline=t+rules.queueMs;queue.push(s);pump();
  return {token:id,...state(s)};
 }
 function get(id,revision){const s=authenticate(id);s.lastSeen=now();pump();if(!sessions.has(id))fail(401,'Session expired');return state(s,revision);}
 function pick(id,input){
  const s=authenticate(id);s.lastSeen=now();pump();
  const g=games.get(s.game),t=now();
  if(!g||g.phase!=='draft'||activeSeat(g)!==s.seat)fail(409,'Not your draft turn');
  if(input.revision!==g.revision)fail(409,'Draft changed');
  if(typeof input.uid!=='string'||!Number.isInteger(input.slot)||!Number.isInteger(input.passiveSlot)||input.slot<0||input.slot>2||input.passiveSlot<0||input.passiveSlot>1)fail(400,'Invalid pick');
  const card=g.match.draft.pool.find(c=>c.uid===input.uid),p=g.match.players[s.seat];
  if(!card||!legal(p,card)||card.kind!=='unit'&&(!p.squad[input.slot]||!canEquip(p.squad[input.slot],card)))fail(400,'Illegal pick');
  // All user input is validated before mutation; stale or late picks cannot spend time twice.
  if(t>=g.turnStart+g.banks[s.seat]){advanceDraft(g,t);fail(409,'Draft clock expired');}
  assign(g.match,s.seat,card.uid,input.slot,input.passiveSlot);
  g.match.draft.picks.at(-1).passiveSlot=input.passiveSlot;
  charge(g,s.seat,t);increment(g,s.seat);g.turnStart=null;g.revision++;advanceDraft(g,t);
  return state(s);
 }
 function leave(id){const s=authenticate(id);s.left=true;removeQueued(s);sessions.delete(id);pump();return {status:'left'};}
 return {join,get,pick,leave,pump,counts:()=>({queued:queue.length,matches:games.size,sessions:sessions.size})};
}
