import {paintStandee,STANDEE_TYPES} from './standee-art.js?v=2026-11-28-audio-410';
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
 const sprites=new Map();let stageKey=null,stage=null;
 function sprite(type){
  if(!makePath)return null;
  if(!sprites.has(type)){
   try{const c=makeCanvas(96,112),ctx=c.getContext('2d');if(!ctx||!paintStandee(ctx,type,makePath))return null;sprites.set(type,c);}
   catch{return null;}
  }
  return sprites.get(type);
 }
 function available(){return STANDEE_TYPES.every(t=>!!sprite(t));}
 function paintStage(ctx,arena,grid){
  // The inner rectangle and every obstacle retain exact logical bounds.
  const g=ctx.createLinearGradient(0,0,0,520);g.addColorStop(0,'#292b30');g.addColorStop(1,'#1b2025');ctx.fillStyle=g;ctx.fillRect(0,0,720,520);
  const floor=ctx.createLinearGradient(20,20,700,500);floor.addColorStop(0,'#505454');floor.addColorStop(.52,'#45494a');floor.addColorStop(1,'#373d41');
  ctx.fillStyle=floor;ctx.fillRect(20,20,680,480);
  ctx.save();ctx.beginPath();ctx.rect(20,20,680,480);ctx.clip();
  // Broad, staggered stone courses, not a repeated image texture.
  if(grid){for(let row=0;row<10;row++){
   const y=20+row*48;ctx.strokeStyle='rgba(18,23,28,.20)';ctx.lineWidth=1;
   for(let col=-1;col<12;col++){
    const x=20+col*64+(row%2)*32;const tint=(row*13+col*17+1000)%5;
    if(tint===0||tint===1){ctx.fillStyle=tint===0?'rgba(255,244,217,.028)':'rgba(5,10,15,.045)';ctx.fillRect(x+1,y+1,62,46);}
    ctx.strokeRect(x,y,64,48);
   }
  }}
  // Subtle arena insignia beneath all pieces.
  ctx.strokeStyle='rgba(205,181,134,.15)';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(360,260,100,0,TAU);ctx.stroke();
  ctx.beginPath();ctx.arc(360,260,106,0,TAU);ctx.stroke();
  ctx.beginPath();ctx.moveTo(360,229);ctx.lineTo(391,260);ctx.lineTo(360,291);ctx.lineTo(329,260);ctx.closePath();ctx.stroke();
  const edge=ctx.createRadialGradient(360,260,140,360,260,408);edge.addColorStop(0,'rgba(0,0,0,0)');edge.addColorStop(1,'rgba(9,14,18,.28)');ctx.fillStyle=edge;ctx.fillRect(20,20,680,480);
  ctx.restore();
  // Architectural frame outside the playable surface, exact inner edge at 20/700/500.
  ctx.fillStyle='#252a2e';ctx.fillRect(8,8,704,12);ctx.fillRect(8,500,704,12);ctx.fillRect(8,20,12,480);ctx.fillRect(700,20,12,480);
  ctx.strokeStyle='#838581';ctx.lineWidth=2;ctx.strokeRect(19,19,682,482);
  ctx.strokeStyle='#b0a48a';ctx.lineWidth=1;ctx.strokeRect(12,12,696,496);
  for(const x of [8,701])for(const y of [8,501]){ctx.fillStyle='#696b67';ctx.fillRect(x,y,11,11);ctx.strokeStyle='#97958c';ctx.strokeRect(x+.5,y+.5,10,10);}
  for(const o of arena?.obstacles||[]){
   // Depth cues remain inside the real collision footprint; no fake obstacles.
   ctx.fillStyle='#242c30';ctx.fillRect(o.x,o.y,o.w,o.h);
   ctx.fillStyle='#565d5d';ctx.fillRect(o.x+2,o.y+2,o.w-4,o.h-10);
   ctx.fillStyle='#777a73';ctx.fillRect(o.x+3,o.y+3,o.w-6,4);
   ctx.fillStyle='#394246';ctx.fillRect(o.x+2,o.y+o.h-8,o.w-4,6);
   ctx.strokeStyle='#a4a294';ctx.lineWidth=1;ctx.strokeRect(o.x+.5,o.y+.5,o.w-1,o.h-1);
   if(grid){ctx.strokeStyle='#454d50';for(let y=o.y+23;y<o.y+o.h-8;y+=24){ctx.beginPath();ctx.moveTo(o.x+3,y);ctx.lineTo(o.x+o.w-3,y);ctx.stroke();}}
  }
 }
 function terrain(ctx,arena,grid,scale=1){
  const key=JSON.stringify([arena?.obstacles||[],!!grid,scale]);
  if(stageKey!==key){
   try{const c=makeCanvas(Math.round(720*scale),Math.round(520*scale)),g=c.getContext('2d');if(!g)return false;g.setTransform(scale,0,0,scale,0,0);paintStage(g,arena,grid);stage=c;stageKey=key;}
   catch{return false;}
  }
  ctx.drawImage(stage,0,0,720,520);return true;
 }
 function base(ctx,p,ghost=false){
  const {x,y,r,color}=p;
  ctx.save();
  if(!ghost){ellipse(ctx,x+2,y+4,r+5,r*.78+4,'rgba(0,0,0,.33)');ellipse(ctx,x,y,r+2,r+2,null,'rgba(225,229,219,.20)',1);}
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
  ctx.save();const width=Math.max(24,p.r*2.45),y=clamp(p.y-artScale(p.r,p.y,2)*91-8,3,510),fraction=clamp(p.hp/p.maxHp,0,1);
  ctx.fillStyle='#20252a';ctx.fillRect(p.x-width/2-1,y-1,width+2,5);
  ctx.fillStyle='#8fdfac';ctx.fillRect(p.x-width/2,y,width*fraction,3);
  // Small class rune beneath the base, distinct from team color.
  ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.textBaseline='top';ctx.lineWidth=3;ctx.strokeStyle='#20252a';
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
 return {available,terrain,piece,label,ghost,preview};
}
