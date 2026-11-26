// Engine subsystem: targeting. See AGENTS.md for ownership and test routes.
import {clamp,distance,clearLine} from './geometry.js?v=engine-323-r1';
import {stats} from './stats.js?v=engine-323-r1';
import {METRICS} from './config.js?v=engine-323-r1';

export function healthFraction(u){return clamp(u.hp/u.maxHp,0,1)}
// Named legacy/experimental arms remain available to diagnostic harnesses.
export function safetySensitivity(u){return 1+(1-healthFraction(u));}
export function engagementPreference(state,u,e,st,d,bonus=.65){
 if(!clearLine(u,e,state.arena))return 0;
 if(d<=st.range)return bonus;
 return (.20*bonus/.65)*Math.max(0,1-(d-st.range)/Math.max(35,st.range*.5));
}
// Same measure of an immediate opponent's pressure for target and position scoring.
// Positive threat weight favors attending to nearby pressure but disfavors exposure.
export function localThreat(state,u,point,e,es){
 const intent=e.intent||{x:0,y:0};
 const future={x:e.x+intent.x*es.speed*.45,y:e.y+intent.y*es.speed*.45};
 const reach=Math.max(1,es.range+es.radius+35);
 const exposure=(p)=>clearLine(point,p,state.arena)?Math.max(0,1-distance(point,p)/reach):0;
 const pressure=Math.max(exposure(e),exposure(future)*.85);
 const aimed=e.focus===u.id?1.25:1;
 return pressure*clamp(es.damage/25,0,2)*aimed;
}
// V2 recognizes engagement likelihood, not potential damage severity.
// Current sight is required. Short forecasts are discounted and cannot pass terrain.
export function encounterPressure(state,u,point,e,es){
 if(e.hp<=0||!clearLine(point,e,state.arena))return 0;
 const reach=Math.max(1,es.range);
 const proximity=p=>{
  const d=distance(point,p);
  return d<=reach?.6+.4*(1-d/reach):0;
 };
 const now=proximity(e);
 const intent=e.intent||{x:0,y:0};
 const future={x:e.x+intent.x*es.speed*.45,y:e.y+intent.y*es.speed*.45};
 const valid=clearLine(e,future,state.arena)&&clearLine(point,future,state.arena);
 const soon=valid?proximity(future):0;
 const intentFactor=e.focus===u.id?1:.75;
 return (.75*now+.25*soon)*intentFactor;
}
// Explicit historical experiment arms; production is the default on 3.3.
export const EVALUATION_ARMS=Object.freeze({
 'engagement-low':{engagement:.20},
 'engagement-mid':{engagement:.40},
 'position-engagement-low':{position:true,engagement:.20},
 'position-engagement-mid':{position:true,engagement:.40},
 'position-engagement-high':{position:true,engagement:.65},
 'position-safety-pressure':{position:true,safetyPressure:true}
});
// Damage opportunity measures access and effective output, not remaining HP.
export function productiveOpportunity(state,u,e,st,d,enemyStats){
 const access=engagementPreference(state,u,e,st,d,.40);
 const efficiency=clamp(Math.max(1,st.damage-enemyStats.defense)/Math.max(1,st.damage),0,1);
 return access*(.75+.25*efficiency);
}
export function targetScoreDetails(state,u,e){
 const w=u.chassis.weights,allies=state.units.filter(a=>a.hp>0&&a.owner===u.owner&&a.id!==u.id),st=stats(u);
 const d=distance(u,e),ratio=healthFraction(e),enemyStats=stats(e),enemyAllies=state.units.filter(a=>a.hp>0&&a.owner===e.owner&&a.id!==e.id);
 const isolated=enemyAllies.length?Math.min(...enemyAllies.map(a=>distance(a,e)))/200:1,nearAllies=allies.length?Math.min(...allies.map(a=>distance(a,e))):250;
 const features={kill:1-ratio,damage:st.damage/Math.max(1,e.hp),threat:enemyStats.damage/30+(e.focus===u.id?.5:0),distance:1-d/500,allyProximity:1-nearAllies/500,safety:d/500,protection:allies.some(a=>e.focus===a.id)?1:0,ability:u.cd<=0?1:0,isolation:clamp(isolated,0,1),preferredRange:1-Math.abs(d-st.range)/500,coordinated:0,independent:allies.length&&!allies.some(a=>a.focus===e.id)?1:0,opportunist:clamp((e.cd||0)/Math.max(.1,enemyStats.rate),0,1),pursuer:e.disengageUntil>state.time?1:Math.max(0,((e.intent?.x||0)*(e.x-u.x)+(e.intent?.y||0)*(e.y-u.y))/Math.max(1,d)),challenger:ratio};
 const experiment=state.aiExperiment??'production';
 if(experiment==='production')features.damage=productiveOpportunity(state,u,e,st,d,enemyStats);
 if(experiment==='safety')features.safety*=safetySensitivity(u);
 if(experiment==='engagement')features.damage+=engagementPreference(state,u,e,st,d);
 const arm=EVALUATION_ARMS[experiment];
 if(arm?.engagement)features.damage+=engagementPreference(state,u,e,st,d,arm.engagement);
 if(experiment==='threat')features.threat=localThreat(state,u,u,e,enemyStats);
 if(experiment==='threat-v2'||experiment==='threat-target')features.threat=encounterPressure(state,u,u,e,enemyStats);
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
