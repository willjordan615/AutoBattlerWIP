// Sparse regularized fit of measured paired rank improvement.
 // Each board has equal total sample weight regardless of number of slots.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {auditBoards} from './draft-choice-trials.js';
import {predictDraft} from '../src/draft-empirical.js';
export function fit(boards,{penalty=8,minBoards=6,iterations=30}={}){
 const counts={},rows=[];
 for(const b of boards){
  const seen=new Set();
  for(const o of b.options){for(const k of Object.keys(o.features))seen.add(k);rows.push({f:o.features,y:o.delta,w:1/b.options.length,pred:0});}
  for(const k of seen)counts[k]=(counts[k]||0)+1;
 }
 const columns={};
 for(const [i,r] of rows.entries())for(const [k,v] of Object.entries(r.f))if(counts[k]>=minBoards)(columns[k]||=[]).push([i,v]);
 const weights={};
 // Ridge coordinate descent, deterministic key ordering; no positive-only
 // constraint and no theoretical synergy target.
 for(let step=0;step<iterations;step++)for(const k of Object.keys(columns).sort()){
  const col=columns[k],old=weights[k]||0;
  const shrink=penalty*(k.startsWith('pair:')||k.startsWith('ally')?2:1);
  let numerator=0,denominator=shrink;
  for(const [i,v] of col){const r=rows[i];numerator+=r.w*v*(r.y-r.pred+old*v);denominator+=r.w*v*v;}
  const next=numerator/denominator;weights[k]=next;
  for(const [i,v] of col)rows[i].pred+=(next-old)*v;
 }
 return {version:1,trainingBoards:boards.length,trainingOptions:rows.length,penalty,minBoards,
  weights:Object.fromEntries(Object.entries(weights).filter(([,v])=>Math.abs(v)>=.001).map(([k,v])=>[k,Number(v.toFixed(5))]))};
}
export function rescore(boards,model){
 return boards.map(b=>({...b,options:b.options.map(o=>({...o,
  // Evaluation uses the same limited profile tilt as runtime.
  empirical:21+40*predictDraft(o.features,model)+Math.max(-3,Math.min(3,(o.personalityTilt||0)*.4))
 }))}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [out,...paths]=process.argv.slice(2);
 const boards=paths.flatMap(p=>JSON.parse(fs.readFileSync(p,'utf8')).boards);
 const model=fit(boards);
 fs.writeFileSync(out,'// Generated from paired in-game trial outcomes.\nexport const EMPIRICAL_MODEL='+JSON.stringify(model)+';\n');
 console.log(JSON.stringify({model,trainingAudit:auditBoards(rescore(boards,model))}));
}
