// Reproduce the original regression fixtures without assertions; compare AI arms.
import {ARENAS,STEP,CHASSIS,makeChassis,spawn,tick,stats,positionScore,tacticalAssessment} from '../src/simulation.js';
const arms=['control','threat-position','position-engagement-mid','production'];
const rows=[];
for(const arm of arms){
 const dash=[];
 for(const [type,speed] of [['bruiser',0],['rogue',0],['bruiser',1]]){
  const p=['bruiser','rogue','ranged','bruiser'].map((t,i)=>({name:'P'+i,hp:100,streak:0,squad:[makeChassis(i===0?type:t)]}));
  const b=spawn(p);b.aiExperiment=arm;b.units=b.units.filter(u=>u.owner===0||u.owner===1).slice(0,2);
  const [u,e]=b.units;Object.assign(u,{x:150,y:200,cd:100});Object.assign(e,{x:290,y:200,cd:100});
  u.chassis.mods.dash=1;u.chassis.mods.speed=speed;
  const s=stats(u),es=stats(e),p0={x:u.x,y:u.y},p1={x:u.x+s.speed*.4*1.3*1.35,y:u.y};
  tick(b,STEP);
  const event=b.visualEvents.find(v=>v.kind==='mobility'&&v.ability==='dash'&&v.owner===0);
  dash.push({type,speed,activated:!!event,netX:u.x-150,displacement:event?Math.hypot(event.toX-event.x,event.toY-event.y):null,weights:u.chassis.weights,opponentRange:es.range,scoreBefore:positionScore(b,u,e,p0,s,[e]),scoreLanding:positionScore(b,u,e,p1,s,[e])});
 }
 const holding=[];
 for(const arena of ARENAS){
  const sides=[0,1].map(i=>({name:'Defensive '+i,hp:100,streak:0,squad:[makeChassis('bruiser'),makeChassis('ranged')]}));
  for(const p of sides)for(const u of p.squad)Object.assign(u.weights,{safety:2.4,distance:.2,damage:.8,protection:1.5});
  const b=spawn(sides,arena,7701);b.aiExperiment=arm;
  for(const u of b.units){u.x=u.owner?525:195;u.y=210+(u.id%100)*55;u.cd=0;}
  b.diagnostics={units:{}};
  for(let i=0;i<180;i++)tick(b,STEP);
  holding.push({arena:arena.name,attacks:b.units.reduce((n,u)=>n+u.combatStats.attacks,0),damage:b.units.reduce((n,u)=>n+u.combatStats.damage,0),tactical:b.diagnostics.tactical});
 }
 rows.push({arm,dash,holding});
}
console.log(JSON.stringify(rows));
