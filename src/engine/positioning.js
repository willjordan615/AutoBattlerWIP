// Engine subsystem: positioning. See AGENTS.md for ownership and test routes.
import {stats,coordinationStacks} from './stats.js?v=engine-323-r1';
import {distance,clearLine,clamp,rectHit} from './geometry.js?v=engine-323-r1';
import {healthFraction,safetySensitivity,localThreat,encounterPressure,EVALUATION_ARMS} from './targeting.js?v=engine-323-r1';
import {METRICS,STEP,CHASSIS,radiusOf} from './config.js?v=engine-323-r1';
import {recentMovement} from './collision.js?v=engine-323-r1';

// Utility movement is deterministic, shares the existing targeting weights, and
// consumes its own cooldown. Terrain still blocks every movement technique.
// Shared movement policy: the same ten editable weights score every position.
// Chassis differ through stats and initial weights, never privileged AI branches.
export function positionScore(state,u,target,point,st,enemies){
 const w=u.chassis.weights,allies=state.units.filter(a=>a.hp>0&&a.owner===u.owner&&a!==u);
 const d=distance(point,target),old=distance(u,target),visible=clearLine(point,target,state.arena);
 // Anticipate where enemies are headed, rather than only where they stand.
 // Intent is captured before any unit moves this tick, so evaluation is order-independent.
 const forecast=enemies.map(e=>{
  const es=stats(e),intent=e.intent||{x:0,y:0};
  const future={x:e.x+intent.x*es.speed*.45,y:e.y+intent.y*es.speed*.45};
  const now=distance(point,e),soon=distance(point,future);
  const exposure=Math.max(0,1-Math.min(now,soon)/Math.max(1,es.range+es.radius+35));
  const approaching=soon<now-3;
  const aimed=e.focus===u.id?1.25:1;
  return {e,es,now,soon,exposure,approaching,aimed};
 });
 const nearest=forecast.reduce((best,f)=>Math.min(best,f.now,f.soon),Infinity);
 const threat=forecast.reduce((sum,f)=>sum+f.exposure*f.es.damage/25*f.aimed,0);
 const approachingThreat=forecast.reduce((sum,f)=>sum+(f.approaching?Math.max(0,1-f.soon/Math.max(90,f.es.range+80))*.65:0)*f.es.damage/25,0);
 const threatenedAllies=allies.filter(a=>enemies.some(e=>e.focus===a.id||distance(e,a)<65));
 const allyDistance=allies.length?Math.min(...allies.map(a=>distance(point,a))):120;
 const protectionDistance=threatenedAllies.length?Math.min(...threatenedAllies.map(a=>distance(point,a))):120;
 const isolated=enemies.filter(e=>e!==target).every(e=>distance(point,e)>90);
 const ideal=st.range*.85;
 const rangeFit=1-Math.min(1,Math.abs(d-ideal)/Math.max(35,st.range*.55));
 const attack=visible&&d<=st.range?1:0;
 const features={
  kill:(1-healthFraction(target))*(attack?.9:.3),
  damage:attack?1:.12,
  threat:-(threat+approachingThreat)*.5, // incoming and imminent exposure
  distance:1-Math.min(1,d/300),
  allyProximity:1-Math.min(1,allyDistance/180),
  safety:Math.min(1,nearest/Math.max(145,st.range*.95))-(threat+approachingThreat)*.55,
  protection:threatenedAllies.length?1-Math.min(1,protectionDistance/180):0,
  ability:(u.cd<=0&&attack?1:0)+(st.dash&&d>st.range&&d<st.range+100?.2:0),
  isolation:isolated?.6:0,
  preferredRange:rangeFit
 };
 // Change only the named metric in each isolated experiment. Holding, formation,
 // route commitments, and the safety exposure term in the threat arm stay fixed.
 if(state.aiExperiment==='safety')features.safety*=safetySensitivity(u);
 if(state.aiExperiment==='threat')features.threat=-forecast.reduce((sum,f)=>sum+localThreat(state,u,point,f.e,f.es),0)*.5;
 const arm=EVALUATION_ARMS[state.aiExperiment];
 if(state.aiExperiment==='threat-v2'||state.aiExperiment==='threat-position'||arm?.position){
  const pressure=forecast.reduce((sum,f)=>sum+encounterPressure(state,u,point,f.e,f.es),0);
  features.threat=-pressure*.5;
  // Separate sensitivity experiment: replace legacy safety exposure with the
  // same damage-independent pressure, preserving distance and existing weight.
  if(arm?.safetyPressure)features.safety=Math.min(1,nearest/Math.max(145,st.range*.95))-pressure*.55;
 }
 let score=METRICS.reduce((sum,k)=>sum+(w[k]||0)*(features[k]||0),0);
 // More safety-conscious allies yield space to teammates who prefer taking risks.
 // The preference is relative: a bold ranged build may stand its ground.
 // A coordinator attracts teammates toward a formation radius without overriding terrain or evasion.
 const coordinators=allies.filter(a=>coordinationStacks(a)>0).sort((a,b)=>coordinationStacks(b)-coordinationStacks(a)||a.id-b.id);
 const coordinator=coordinators[0],myWeight=coordinationStacks(u);
 if(coordinator&&!attack&&(coordinationStacks(coordinator)>myWeight||(coordinationStacks(coordinator)===myWeight&&coordinator.id<u.id))){
  const desired=st.radius+radiusOf(coordinator)+55;
  const excess=Math.max(0,distance(point,coordinator)-desired);
  score-=.65*coordinationStacks(coordinator)*Math.min(2,excess/100);
 }
 const mySafety=w.safety||0;
 for(const ally of allies){
  const theirSafety=ally.chassis.weights.safety||0;
  const yielding=Math.max(0,mySafety-theirSafety);
  if(!yielding)continue;
  const separation=distance(point,ally),now=distance(u,ally);
  const buffer=st.radius+stats(ally).radius+26;
  const allyIntent=ally.intent||{x:0,y:0};
  const nextAlly={x:ally.x+allyIntent.x*stats(ally).speed*.35,y:ally.y+allyIntent.y*stats(ally).speed*.35};
  const predicted=distance(point,nextAlly);
  score-=yielding*.85*Math.max(0,1-Math.min(separation,predicted)/buffer);
  if(now<buffer+18&&separation<now)score-=yielding*.22*(now-separation)/Math.max(1,st.speed*STEP);
 }
 // Small inertial preference avoids jitter and keeps neutral weights functional.
 score+=.08*(d<old?1:0)-.03*distance(u,point)/Math.max(1,st.speed);
 return score;
}
// Deliberate holding is a tactical option, not an inactivity timer.
// Only favor it when combat is available here or an opponent is actually
// advancing into this position. A distant or stationary enemy must be pursued.
export function holdingOpportunity(state,u,target,st,enemies){
 const d=distance(u,target),visible=clearLine(u,target,state.arena);
 if(!visible)return 0;
 const targetRadius=radiusOf(target);
 // An enemy's collision radius is not attack access: attack initiation in
 // tick() requires center distance <= st.range. Otherwise two melee fighters
 // can both 'hold' a position where neither is actually able to attack.
 const striking=d<=st.range;
 const desired=st.range*.82;
 // Standing in melee range is useful; ranged fighters threatened at point
 // blank range must remain free to seek a safer firing position.
 const tooClose=u.type==='ranged'&&d<desired*.65;
 const incoming=enemies.some(e=>e.hp>0&&e!==target&&distance(u,e)<stats(e).range+radiusOf(u)+12);
 if(tooClose||incoming)return 0;
 let approach=0;
 if(!striking&&d<st.range+targetRadius+110){
  const history=(target.motion||[]).filter(p=>p.time>=state.time-.65);
  let vx=0,vy=0;
  if(history.length>1){
   const first=history[0],last=history[history.length-1],elapsed=last.time-first.time;
   if(elapsed>.05){vx=(last.x-first.x)/elapsed;vy=(last.y-first.y)/elapsed}
  }else if(target.moveDecision){
   const dir=target.moveDecision;
   vx=dir.x*stats(target).speed;vy=dir.y*stats(target).speed;
  }
  const toward=((u.x-target.x)*vx+(u.y-target.y)*vy)/Math.max(1,d);
  const future={x:target.x+vx*.9,y:target.y+vy*.9};
  const futureD=distance(u,future);
  if(toward>stats(target).speed*.18&&futureD<=st.range+targetRadius+20)
   approach=Math.min(1,(d-futureD)/Math.max(1,stats(target).speed*.5));
 }
 if(!striking&&!approach)return 0;
 const exposed=enemies.some(e=>e.hp>0&&e!==target&&
  clearLine(e,u,state.arena)&&distance(e,u)<=stats(e).range+radiusOf(u));
 const exposedPenalty=exposed?.2:0;
 const inRangeBonus=striking?.23:0;
 const incomingBonus=approach*.5;
 const stableBonus=(u.previouslyHolding? .12:0);
 // Standing in the wrong range isn't a good defensive position.
 const tooNear=striking&&d<Math.min(desired*.55,radiusOf(u)+targetRadius+5);
 // Holding must not override deliberately extreme targeting weights: a
 // distance-focused fighter can press forward, a safety-focused one retreat.
 const w=u.chassis.weights;
 const preferenceScale=1+Math.max(0,(w.distance||0)-1)*.75+
  Math.max(0,(w.safety||0)-1)*.75;
 return Math.max(0,inRangeBonus+incomingBonus+stableBonus-exposedPenalty-(tooNear?.17:0))/preferenceScale*(1+Math.min(1,(u.chassis.mods.patience||0)*.3));
}
// Support a real ally engagement, not merely an ally having selected a target.
// In particular, a distant team with reciprocal target focus must still pursue
// normally instead of treating everyone else as already engaged.
export function cooperativeEngagement(state,u,st,enemies){
 const allies=state.units.filter(a=>a!==u&&a.hp>0&&a.owner===u.owner);
 if(!allies.length||u.attack||u.followthroughCommit?.until>state.time||
    u.disengageUntil>state.time)return null;
 // No coordination override for a fighter already able to attack something.
 if(enemies.some(e=>clearLine(u,e,state.arena)&&
    distance(u,e)<=st.range))return null;
 const wasIdle=u.supportNavigation!=null||u.previouslyHolding||u.holdingPosition||
  (!u.moveDecision?.x&&!u.moveDecision?.y)||
  recentMovement(u,state.time)<Math.max(2,st.speed*.08);
 if(!wasIdle)return null;
 const options=[];
 for(const ally of allies){
  const enemy=enemies.find(e=>e.id===ally.focus);
  if(!enemy)continue;
  const ast=stats(ally),d=distance(ally,enemy);
  const visible=clearLine(ally,enemy,state.arena);
  const attacking=!!ally.attack||(ally.lastAttackAt!=null&&state.time-ally.lastAttackAt<1.1);
  const inReach=visible&&d<=ast.range+radiusOf(enemy)+10;
  const intent=ally.moveDecision||{x:0,y:0};
  const pursuit=(enemy.x-ally.x)*intent.x+(enemy.y-ally.y)*intent.y;
  const activelyClosing=visible&&d<290&&pursuit>Math.max(8,d*.2);
  if(!attacking&&!inReach&&!activelyClosing)continue;
  const dx=(enemy.x-ally.x)/Math.max(1,d),dy=(enemy.y-ally.y)/Math.max(1,d);
  const side=(u.id+ally.id)%2?1:-1;
  const screen=st.hp>=ast.hp*1.12&&st.range<ast.range*.9;
  let point;
  if(screen){
   const forward=Math.min(85,Math.max(34,d*.45));
   point={x:ally.x+dx*forward,y:ally.y+dy*forward};
  }else{
   const reach=Math.max(st.radius+radiusOf(enemy)+7,st.range*.78);
   const flank=Math.min(42,Math.max(23,st.radius+ast.radius+5));
   point={x:enemy.x-dx*reach-dy*side*flank,
    y:enemy.y-dy*reach+dx*side*flank};
  }
  const r=st.radius+3;
  point.x=clamp(point.x,20+r,700-r);point.y=clamp(point.y,20+r,500-r);
  if(state.arena.obstacles.some(o=>rectHit(point.x,point.y,r+2,o)))continue;
  // Avoid forming a pile or abandoning an active personal engagement.
  const crowded=allies.filter(a=>a!==ally&&a.supportingAlly===ally.id&&distance(a,point)<65).length;
  const score=(attacking?3:inReach?2:1)+
    (screen&&ally.type==='ranged'?1:0)-
    distance(u,point)*.005-crowded*1.7;
  options.push({allyId:ally.id,enemyId:enemy.id,point,
   mode:screen?'screen':'support',score});
 }
 options.sort((a,b)=>b.score-a.score||a.allyId-b.allyId);
 return options[0]||null;
}
