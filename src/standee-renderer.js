import {paintCourtyard} from './courtyard-art.js?v=2026-11-28-painted-chassis-504';
import {paintStandee,STANDEE_TYPES} from './standee-art.js?v=2026-11-28-painted-chassis-504';
// All inputs are presentation snapshots; never mutate units, terrain, or engine RNG.
const makeDefaultCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const TAU=Math.PI*2;
export const STANDEE_SCALE=4.05;
const artScale=(r,y,bob=0)=>Math.min(r*STANDEE_SCALE/96,Math.max(.2,(y-bob-2)/91));
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const ellipse=(ctx,x,y,rx,ry,fill,stroke=null,width=1)=>{
 ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);
 if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
};
export function poseFor(piece,time,animate=true){
 const facing=Number.isFinite(piece.facing)?piece.facing:0;
 const flip=Math.cos(facing)<-.1?-1:1;
 if(!animate)return {flip,bob:0,lean:0};
 const move=piece.moving?1:0,phase=piece.attackPhase;
 const bob=move?Math.abs(Math.sin(time*13+piece.id*.7))*1.7:Math.sin(time*3+piece.id)*.45;
 const lean=phase==='windup'?-.10:phase==='recovery'?.11:move?.055:0;
 return {flip,bob,lean};
}
export function createStandeeRenderer({makeCanvas=makeDefaultCanvas,makePath=typeof Path2D==='function'?d=>new Path2D(d):null}={}){
 const sprites=new Map(),illustrations=new Map();let stageKey=null,stage=null;
 let illustrationLoad=null;
 // The same compact, transparent artwork is used in portraits and the arena. Vector art remains an immediate fallback.
 function loadIllustrations(makeImage=typeof Image==='function'?()=>new Image():null){
  if(!makeImage)return Promise.resolve(false);
  if(!illustrationLoad)illustrationLoad=Promise.all(STANDEE_TYPES.map(type=>new Promise(resolve=>{
   try{const image=makeImage();image.onload=()=>{if(image.naturalWidth===96&&image.naturalHeight===112){illustrations.set(type,image);resolve(true)}else resolve(false)};image.onerror=()=>resolve(false);image.src=new URL('../assets/art/'+type+'-painted.webp?v=2026-11-28-painted-chassis-504',import.meta.url).href;}catch{resolve(false)}
  }))).then(loaded=>loaded.some(Boolean));
  return illustrationLoad;
 }
 function sprite(type){
  if(illustrations.has(type))return illustrations.get(type);
  if(!makePath)return null;
  if(!sprites.has(type)){
   try{const c=makeCanvas(96,112),ctx=c.getContext('2d');if(!ctx||!paintStandee(ctx,type,makePath))return null;sprites.set(type,c);}
   catch{return null;}
  }
  return sprites.get(type);
 }
 function available(){return STANDEE_TYPES.every(t=>!!sprite(t));}
 function terrain(ctx,arena,grid,scale=1){
  const key=JSON.stringify([arena?.obstacles||[],!!grid,scale]);
  if(stageKey!==key){
   try{const c=makeCanvas(Math.round(720*scale),Math.round(520*scale)),g=c.getContext('2d');if(!g)return false;g.setTransform(scale,0,0,scale,0,0);paintCourtyard(g,arena,grid);stage=c;stageKey=key;}
   catch{return false;}
  }
  ctx.drawImage(stage,0,0,720,520);return true;
 }
 function base(ctx,p,ghost=false){
  const {x,y,r,color}=p;
  ctx.save();
  if(!ghost){ellipse(ctx,x+2,y+4,r+5,r*.78+4,'rgba(0,0,0,.33)');ellipse(ctx,x,y,r+2,r+2,null,'rgba(225,229,219,.30)',1);}
  ellipse(ctx,x,y+3,r+3,r*.77,'#171d22',null);
  ellipse(ctx,x,y+1,r+3,r*.77,color,p.selected?'#ffffff':p.local?'#eef0e7':'#20252a',p.selected||p.local?2:1.5);
  ellipse(ctx,x,y,r*.64,r*.36,'#373d40',null);
  ctx.restore();
 }
 function piece(ctx,p,time,animate=true){
  const art=sprite(p.type);if(!art)return false;
  const {x,y,r}=p,pose=poseFor(p,time,animate),s=artScale(r,y,pose.bob);
  base(ctx,p);
  ctx.save();ctx.translate(x,y-pose.bob);ctx.scale(pose.flip,1);ctx.rotate(pose.lean);
  ctx.drawImage(art,-48*s,-96*s,96*s,112*s);ctx.restore();
  // Draw the near edge over the artwork so boots and equipment cannot hide affiliation.
  ctx.save();ctx.beginPath();ctx.ellipse(x,y+1,r+1.5,r*.69,0,.16,Math.PI-.16);ctx.strokeStyle=p.color;ctx.lineWidth=3;ctx.lineCap='round';ctx.stroke();ctx.restore();
  return true;
 }
 function label(ctx,p){
  ctx.save();const width=Math.max(30,p.r*2.65),y=clamp(p.y-artScale(p.r,p.y,2)*91-10,3,510),fraction=clamp(p.hp/p.maxHp,0,1);
  ctx.fillStyle='#171d1e';ctx.fillRect(p.x-width/2-2,y-2,width+4,8);
  ctx.fillStyle=p.color;ctx.fillRect(p.x-width/2,y,width*fraction,4);
  // Small class rune beneath the base, distinct from team color.
  ctx.font='bold 13px system-ui';ctx.textAlign='center';ctx.textBaseline='top';ctx.lineWidth=3.5;ctx.strokeStyle='#171d1e';
  const text=p.type==='bruiser'?'B':p.type==='rogue'?'R':'A';ctx.strokeText(text,p.x,p.y+p.r*.77+6);ctx.fillStyle='#eee9d9';ctx.fillText(text,p.x,p.y+p.r*.77+6);ctx.restore();
 }
 function ghost(ctx,p,t){
  const art=sprite(p.type);if(!art)return false;
  ctx.save();ctx.globalAlpha=(1-t)*.36;const s=artScale(p.r,p.y);
  ctx.strokeStyle=p.color;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.toX,p.toY);ctx.stroke();
  ctx.translate(p.x,p.y);ctx.scale(p.toX<p.x?-1:1,1);ctx.drawImage(art,-48*s,-96*s,96*s,112*s);ctx.restore();return true;
 }
 function preview(canvas){
  if(!canvas||!available())return false;
  const ctx=canvas.getContext('2d');if(!ctx)return false;
  ctx.fillStyle='#393f42';ctx.fillRect(0,0,canvas.width,canvas.height);
  STANDEE_TYPES.forEach((type,i)=>{
   const x=(i+.5)*canvas.width/3,y=canvas.height-31;
   piece(ctx,{x,y,r:18,type,id:i,color:['#64b3ff','#f58086','#f4d16f'][i]},0,false);
   ctx.fillStyle='#e8e3d6';ctx.font='12px system-ui';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(type[0].toUpperCase()+type.slice(1),x,y+14);
  });return true;
 }
 return {available,terrain,piece,label,ghost,preview,loadIllustrations};
}
