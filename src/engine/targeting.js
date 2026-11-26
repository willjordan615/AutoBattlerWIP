// Engine subsystem: targeting. See AGENTS.md for ownership and test routes.
import {clamp,distance} from './geometry.js?v=engine-323-r1';
import {stats} from './stats.js?v=engine-323-r1';
import {METRICS} from './config.js?v=engine-323-r1';

export function healthFraction(u){return clamp(u.hp/u.maxHp,0,1)}
export function targetScoreDetails(state,u,e){
 const w=u.chassis.weights,allies=state.units.filter(a=>a.hp>0&&a.owner===u.owner&&a.id!==u.id),st=stats(u);
 const d=distance(u,e),ratio=healthFraction(e),enemyStats=stats(e),enemyAllies=state.units.filter(a=>a.hp>0&&a.owner===e.owner&&a.id!==e.id);
 const isolated=enemyAllies.length?Math.min(...enemyAllies.map(a=>distance(a,e)))/200:1,nearAllies=allies.length?Math.min(...allies.map(a=>distance(a,e))):250;
 const features={kill:1-ratio,damage:st.damage/Math.max(1,e.hp),threat:enemyStats.damage/30+(e.focus===u.id?.5:0),distance:1-d/500,allyProximity:1-nearAllies/500,safety:d/500,protection:allies.some(a=>e.focus===a.id)?1:0,ability:u.cd<=0?1:0,isolation:clamp(isolated,0,1),preferredRange:1-Math.abs(d-st.range)/500,coordinated:0,independent:allies.length&&!allies.some(a=>a.focus===e.id)?1:0,opportunist:clamp((e.cd||0)/Math.max(.1,enemyStats.rate),0,1),pursuer:e.disengageUntil>state.time?1:Math.max(0,((e.intent?.x||0)*(e.x-u.x)+(e.intent?.y||0)*(e.y-u.y))/Math.max(1,d)),challenger:ratio};
 const contributions=Object.fromEntries(METRICS.map(k=>[k,(w[k]||0)*(features[k]||0)]));
 const restlessness=u.chassis.mods.restless||0;
 const recent=u.lastAttacked===e.id?Math.max(0,1-(state.time-u.lastAttackAt)/3):0;
 const total=METRICS.reduce((sum,k)=>sum+contributions[k],0)+(u.focus===e.id?.2:0)-Math.min(2.4,.9*restlessness)*recent;
 return {total,features,contributions};
}
function selectTarget(state,u,enemies){
 if(u.tauntedUntil>state.time){const forced=enemies.find(e=>e.id===u.tauntedBy);if(forced)return forced}
 let best=null,score=-Infinity;
 for(const e of enemies){const value=targetScoreDetails(state,u,e).total;if(value>score){score=value;best=e}}
 const current=enemies.find(e=>e.id===u.focus);
 // Routing to a target is a commitment. Small score changes should not flip
 // destinations every tick, especially while turning around solid obstacles.
 if(current&&current!==best){
  const currentScore=targetScoreDetails(state,u,current).total;
  const hysteresis=u.navigation?.path?.length?.6:.24;
  if(score-currentScore<hysteresis)return current;
 }
 return best;
}

 // Diagnostic wrapper: the original selector is authoritative, including tie order and taunt.
export function chooseTarget(state,u,enemies,stage='direct'){
 const selected=selectTarget(state,u,enemies);
 if(!state.decisionAudit)return selected;
 const audit=state.decisionAudit,rows=audit.units||=(Object.create(null));
 const row=rows[u.id]||={type:u.type,owner:u.owner,targets:[],moves:[],counts:{}};
 const c=row.counts;
 c[stage+'Calls']=(c[stage+'Calls']||0)+1;
 if(stage==='intent')row.intentTarget=selected?.id??null;
 if(stage==='action'){
  const id=selected?.id??null;
  if(row.intentTarget!==id)c.intentActionDisagreements=(c.intentActionDisagreements||0)+1;
  if(row.lastActionTarget!=null&&id!==row.lastActionTarget)c.actionSwitches=(c.actionSwitches||0)+1;
  row.lastActionTarget=id;
 }
 if(state.tick%(audit.interval||15)===0&&row.targets.length<(audit.limit||128)){
  const ranked=enemies.map(e=>({id:e.id,...targetScoreDetails(state,u,e)})).sort((a,b)=>b.total-a.total);
  const chosen=ranked.find(e=>e.id===selected?.id);
  const alternative=ranked.find(e=>e.id!==selected?.id);
  const forced=u.tauntedUntil>state.time&&selected?.id===u.tauntedBy;
  row.targets.push({tick:state.tick,stage,focus:u.focus,chosen,alternative,
   rawBest:ranked[0]?.id??null,forced:!!forced,
   reason:forced?'taunt':chosen?.id!==ranked[0]?.id?'hysteresis':'score',
   margin:chosen&&alternative?chosen.total-alternative.total:null});
 }
 return selected;
}
