// Presentation-only aggregation of authoritative match history.
export function summarizeMatch(match,seat){
 const history=match.history||[],players=match.players;
 const standings=players.map((p,i)=>{
  const eliminated=history.find(r=>r.remaining[i]===0);
  return {seat:i,name:p.name,hp:p.hp,eliminatedRound:eliminated?.round??null,roundPlace:eliminated?eliminated.ranking.indexOf(i):0};
 }).sort((a,b)=> (b.eliminatedRound??Infinity)-(a.eliminatedRound??Infinity)||a.roundPlace-b.roundPlace||a.seat-b.seat);
 const fighters=new Map(),modules=new Map();
 const fields=['damage','damageTaken','prevented','evaded','dodges','interceptions','haste','focus','bulwark','followthrough'];
 let rounds=0,wins=0;
 for(const round of history){
  if(round.ranking.includes(seat)){rounds++;if(round.ranking[0]===seat)wins++;}
  for(const unit of round.combatReport||[]){
   if(unit.owner!==seat)continue;
   let f=fighters.get(unit.id);
   if(!f){f={id:unit.id,type:unit.type,rounds:0,survived:0,...Object.fromEntries(fields.map(k=>[k,0]))};fighters.set(unit.id,f);}
   f.rounds++;f.survived+=Number(!!unit.survived);
   for(const k of fields)f[k]+=unit[k]||0;
   for(const [k,v] of Object.entries(unit.moduleDamage||{}))modules.set(k,(modules.get(k)||0)+v);
  }
 }
 const squad=[...fighters.values()].sort((a,b)=>a.id-b.id);
 return {placement:standings.findIndex(p=>p.seat===seat)+1,standings,rounds,wins,totalRounds:history.length,
  squad,totals:Object.fromEntries(fields.map(k=>[k,squad.reduce((sum,f)=>sum+f[k],0)])),
  moduleDamage:[...modules].filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1])};
}
export function renderMatchSummary({headline,results,summary,match,seat,colors,chassis,onMenu,onReplay}){
 const report=summarizeMatch(match,seat),fmt=n=>Math.round(n*10)/10;
 const el=(tag,value,cls)=>{const n=document.createElement(tag);n.textContent=value;if(cls)n.className=cls;return n;};
 const ordinal=['','1st','2nd','3rd','4th'];
 headline.replaceChildren(el('strong',ordinal[report.placement]+' place overall'),el('p',report.totalRounds+' rounds · '+report.wins+' wins in '+report.rounds+' rounds played','muted'));
 results.replaceChildren(el('h2','Final standings'));
 for(const [i,p] of report.standings.entries()){
  const row=el('div','','placement-row'),name=el('strong','#'+(i+1)+' '+p.name);name.style.color=colors[p.seat];
  row.append(name,el('span',p.eliminatedRound===null?p.hp+' HP left':'Out · round '+p.eliminatedRound));results.append(row);
 }
 summary.replaceChildren(el('h2','Your squad · full match'));
 const metrics=el('div','','match-metrics');
 for(const [label,value] of [['Damage dealt',report.totals.damage],['Damage prevented',report.totals.prevented],['Damage taken',report.totals.damageTaken],['Attacks evaded',report.totals.evaded]]){
  const item=el('div','','match-metric');item.append(el('strong',String(fmt(value))),el('span',label));metrics.append(item);
 }
 summary.append(metrics);
 for(const f of report.squad){
  const row=el('div','','round-stat');
  row.append(el('strong',(chassis[f.type]?.name||f.type)+' #'+(f.id%100+1)),el('span',fmt(f.damage)+' dealt · '+fmt(f.damageTaken)+' taken · '+fmt(f.prevented)+' prevented'),el('span',f.survived+'/'+f.rounds+' rounds survived · '+f.dodges+' dodge rolls · '+f.interceptions+' interceptions'),el('small','Utility: '+f.haste+' haste · '+f.focus+' focus · '+f.bulwark+' bulwark · '+f.followthrough+' follow-through','muted'));
  summary.append(row);
 }
 if(report.moduleDamage.length){
  summary.append(el('h2','Bonus damage by module'));
  for(const [name,value] of report.moduleDamage){
   const row=el('div','','round-stat'),bar=el('div','','damage-bar'),fill=el('i','');
   fill.style.width=100*value/report.moduleDamage[0][1]+'%';bar.append(fill);
   row.append(el('strong',name+' · '+fmt(value)),bar);summary.append(row);
  }
  summary.append(el('small','Only directly attributed bonus damage is shown. Utility and delivery effects are not ranked by damage.','muted'));
 }
 const actions=el('div','','match-actions');
 const menu=el('button','Return to Menu','secondary');menu.onclick=onMenu;
 const replay=el('button','Play Again','secondary');replay.onclick=onReplay;
 actions.append(menu,replay);summary.append(actions);
}
