// Explicit seat-0 policy via existing interactive playtest harness; no hidden picks.
import assert from 'node:assert/strict';
import {createPlaytest} from './playtest-harness.js';
const start=Number(process.argv[2]||3301),games=[];
for(let i=0;i<2;i++){
 const types=i===0?['ranged','bruiser','rogue','bruiser']:['rogue','ranged','bruiser','rogue'];
 const session=createPlaytest({seed:start+i,types,traceInterval:1});
 const picks=[];
 const policy=s=>{
  const p=s.players[0];
  const choices=s.draft.choices.map(c=>{
   const u=p.squad[c.slot];
   let value=c.botScore;
   if(c.kind==='unit')value+=p.squad.length===1?18:4;
   if(c.kind==='target'){
    const bias=i===0?{coward:15,skirmisher:14,duelist:10,guardian:6,aggressor:6}:{guardian:15,duelist:13,aggressor:8,opportunist:6};
    value+=bias[c.key]||0;
    if(u&&u.type==='ranged'&&['coward','skirmisher'].includes(c.key))value+=8;
    if(u&&u.type==='rogue'&&['duelist','guardian'].includes(c.key))value+=6;
    if(u)value-=u.modules.filter(m=>m.name===c.card).length*4;
   }
   return {...c,value};
  }).sort((a,b)=>b.value-a.value);
  const c=choices[0];assert.ok(c);
  picks.push({round:s.round,card:c.card,kind:c.kind,key:c.key,slot:c.slot,passiveSlot:c.passiveSlot,score:c.value,alternatives:choices.slice(1,4).map(x=>({card:x.card,slot:x.slot,score:x.value}))});
  return {uid:c.uid,slot:c.slot,passiveSlot:c.passiveSlot};
 };
 const result=session.run(policy,{trace:true});
 assert.ok(result.completed);
 games.push({seed:start+i,starting:types[0],winner:result.winner,rounds:result.rounds.length,timeouts:result.rounds.filter(r=>r.timedOut).length,picks,finalSquad:result.final.players[0].squad,roundReports:result.rounds});
}
console.log(JSON.stringify({games,completed:games.length}));
