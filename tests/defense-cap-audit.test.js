import test from 'node:test';
import {setAuditDefenseCap} from '../src/engine/stats.js?v=engine-322-ft1';
import assert from 'node:assert/strict';
import {catalog,assign,canEquip,rankRound} from '../src/headless.js';
import {CHASSIS,ARENAS,STEP,makeChassis,rng,spawn,tick,teamPercent,distance,radiusOf} from '../src/simulation.js';
const types=Object.keys(CHASSIS),cards=catalog.filter(c=>c.kind!=='unit'),byKey=new Map(cards.map(c=>[c.key,c]));
const builds=[
 {name:'mobile',type:'rogue',core:[[0,'followthrough'],[0,'followthrough']],other:[[0,'restless'],[0,'momentum']],stress:[[0,'followthrough'],[0,'followthrough'],[0,'restless'],[0,'momentum']]},
 {name:'juggernaut',type:'bruiser',core:[[0,'growth'],[0,'bulwark']],other:[[0,'fortify'],[0,'fortify']],stress:[[0,'fortify'],[0,'fortify'],[0,'resolve'],[0,'resolve']]},
 {name:'kite',type:'ranged',core:[[0,'shrink'],[0,'disengage']],other:[[0,'backstep'],[0,'disengage']],stress:[[0,'disengage'],[0,'disengage'],[0,'backstep'],[0,'coward']]},
 {name:'formation',type:'bruiser',core:[[0,'coordinated'],[0,'coordinated']],other:[[0,'inspiration'],[1,'aegis']],stress:[[0,'coordinated'],[1,'rally'],[1,'dash'],[0,'guardian']]},
 {name:'area',type:'ranged',core:[[0,'piercing'],[0,'area']],other:[[0,'projectiles'],[0,'chain']],stress:[[0,'piercing'],[0,'area'],[0,'projectiles'],[0,'chain']]},
 {name:'reactive',type:'bruiser',core:[[0,'anchor'],[0,'retaliation']],other:[[0,'resolve'],[0,'resolve']],stress:[[0,'resolve'],[0,'resolve'],[0,'steadfast'],[0,'steadfast']]}
];
function equip(players,seat,index,key){
 const card=byKey.get(key),ch=players[seat].squad[index];
 assert.ok(card&&canEquip(ch,card),key+' must be legal');
 const pick={...card,uid:'audit'};
 const m={players,phase:'draft',draft:{pool:[pick],originalPool:[pick],order:[seat],turn:0,picks:[]}};
 assign(m,seat,pick.uid,index);
}
function randomPicks(players,seat,count,random,indices=null){
 for(let k=0;k<count;k++){
  const eligible=indices||players[seat].squad.map((_,j)=>j);
  const choices=eligible.flatMap(j=>cards.filter(c=>{
   const ch=players[seat].squad[j];
   if(!canEquip(ch,c))return false;
   if(c.kind==='morphology'&&(ch.mods.growth||ch.mods.shrink))return false;
   if((c.kind==='passive'||c.kind==='utility')&&ch.passives.length>=2&&!ch.passives.includes(c.key))return false;
   return true;
  }).map(c=>[j,c.key]));
  const [j,key]=choices[Math.floor(random()*choices.length)];
  equip(players,seat,j,key);
 }
}
function run(build,seed,size,variant,omit=null){
 const random=rng(seed*109+size*13),seat=seed%4,round=1+seed%ARENAS.length;
 const players=Array.from({length:4},(_,i)=>({name:'P'+i,hp:100,squad:Array.from({length:size},(_,j)=>makeChassis(i===seat&&j===0?build.type:types[Math.floor(random()*types.length)]))}));
 const budget=variant.startsWith('stress')?8:4;
 // Identical opponents within each paired scenario, with a realistic mix of legal cards.
 for(let i=0;i<4;i++)if(i!==seat)randomPicks(players,i,budget,random);
 const picks=variant==='core'?build.core:variant==='other'?build.other:variant==='full'||variant==='stressfull'?[...build.core,...build.other,...(variant==='stressfull'?build.stress:[])]:[];
 for(const [j,key] of picks)if(key!==omit)equip(players,seat,j,key);
 if(variant==='random'||variant==='stressrandom')randomPicks(players,seat,budget,rng(seed*307+size),build.name==='formation'?[0,1]:[0]);
 const b=spawn(players,ARENAS[round-1],seed,round);b.moduleTelemetry={};
 let switches=0,lastTarget=null,bonusCount=0,lastBonusTarget=null,lastBonusTime=-Infinity,formationFrames=0,formationNear=0,engagedFrames=0,farFrames=0;
 const focal=b.units.find(u=>u.id===seat*100);
 for(let t=0;t<900;t++){
  const end=tick(b,STEP);
  for(const u of b.units)assert.ok(Number.isFinite(u.x)&&Number.isFinite(u.y)&&Number.isFinite(u.hp)&&u.hp>=0&&u.hp<=u.maxHp+1e-6,'finite legal state');
  if(focal.hp>0){
   if(focal.lastAttacked!=null&&focal.lastAttacked!==lastTarget){if(lastTarget!=null)switches++;lastTarget=focal.lastAttacked;}
   if(focal.lastFollowthroughBonusTargetId!==lastBonusTarget&&focal.lastFollowthroughBonusTargetId!=null){
    assert.notEqual(focal.lastFollowthroughBonusTargetId,lastBonusTarget);
    assert.ok(b.time-lastBonusTime>=1-STEP-1e-8,'bonus cooldown');
    lastBonusTarget=focal.lastFollowthroughBonusTargetId;lastBonusTime=b.time;bonusCount++;
   }
   assert.equal(focal.combatStats.followthroughBonus||0,bonusCount,'no repeat bonus target');
   if(b.tick%10===0){
    const allies=b.units.filter(u=>u.owner===seat&&u!==focal&&u.hp>0),enemies=b.units.filter(u=>u.owner!==seat&&u.hp>0);
    for(const a of allies){formationFrames++;if(distance(a,focal)<=100)formationNear++;}
    if(enemies.length){engagedFrames++;if(Math.min(...enemies.map(e=>distance(e,focal)))>160)farFrames++;}
   }
  }
  if(end!==null)break;
 }
 const rank=rankRound({players,seed,round},b),metrics={},damage={};
 for(const u of b.units.filter(u=>u.owner===seat)){
  for(const [key,row] of Object.entries(b.moduleTelemetry[u.id]||{}))for(const [metric,value] of Object.entries(row))metrics[key+'.'+metric]=(metrics[key+'.'+metric]||0)+value;
  for(const [key,v] of Object.entries(u.combatStats.moduleDamage||{}))damage[key]=(damage[key]||0)+v;
  for(const [key,v] of Object.entries(u.combatStats.moduleHits||{}))damage['delivery:'+key]=(damage['delivery:'+key]||0)+v;
 }
 return {win:Number(rank[0]===seat),place:rank.indexOf(seat)+1,hp:teamPercent(b,seat),damage:b.damageDealt[seat],fighterDamage:focal.combatStats.damage,attacks:focal.combatStats.attacks,followthrough:focal.combatStats.followthrough||0,bonuses:focal.combatStats.followthroughBonus||0,switches,formationFrames,formationNear,engagedFrames,farFrames,stalls:b.units.reduce((n,u)=>n+(u.navStuckCount||0),0),time:b.time,timeout:Number(b.time>=30-1e-6),metrics,moduleDamage:damage};
}
function aggregate(rows){const out={n:rows.length,metrics:{},moduleDamage:{}};for(const r of rows){for(const [k,v] of Object.entries(r)){if(typeof v==='number')out[k]=(out[k]||0)+v;else for(const [key,val] of Object.entries(v))out[k][key]=(out[k][key]||0)+val;}}return out;}
test('3.2 defensive cap and ablation audit',()=>{
 for(const cap of [Infinity,10,9,8]){
  setAuditDefenseCap(cap);
  for(const build of [builds[1],builds[5]]){
   const scenarios=[['bare','bare',null],['core','core',null],['full','full',null],['random','random',null],['stressfull','stressfull',null],['stressrandom','stressrandom',null],...(cap===Infinity||cap===10?(build.name==='juggernaut'?['growth','bulwark','fortify','resolve']:['anchor','retaliation','resolve','steadfast']).map(key=>['without:'+key,'stressfull',key]):[])];
   const rows={};
   for(const [label,variant,omit] of scenarios){
    rows[label]=aggregate(Array.from({length:24},(_,i)=>run(build,7300+i,3,variant,omit)));
   }
   console.log('CAP_RESULT '+JSON.stringify({cap:Number.isFinite(cap)?cap:'none',build:build.name,rows}));
  }
 }
 setAuditDefenseCap(Infinity);
});
