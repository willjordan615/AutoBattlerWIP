// Presentation-only asset adapter. Classic remains independent of asset loading.
export const THEME_ASSETS=Object.freeze({pawn:'pawn.png',tiles:'tiles.png',wall:'wall.png'});
export function createArenaTheme({makeImage=()=>new Image(),onReady=()=>{}}={}){
 let images=null,ready=false,loading=false;
 const cache=new WeakMap();
 function load(){
  if(ready||loading||typeof Image==='undefined'&&makeImage===undefined)return;
  loading=true;
  try{
   const next={};let remaining=Object.keys(THEME_ASSETS).length,failed=false;
   for(const [key,name] of Object.entries(THEME_ASSETS)){
    const img=makeImage();next[key]=img;
    img.onload=()=>{if(--remaining===0&&!failed){images=next;ready=true;loading=false;onReady();}};
    img.onerror=()=>{failed=true;loading=false;};
    img.src=new URL('../assets/scribble/'+name,import.meta.url).href;
   }
  }catch{loading=false;}
 }
 function active(theme){return theme==='scribble'&&ready;}
 function terrain(ctx,arena,grid){
  // Cache tiled arena by geometry and grid preference, one raster per arena.
  if(!arena)return false;
  let cached=cache.get(arena);
  if(!cached||cached.grid!==grid){
   const canvas=document.createElement('canvas');canvas.width=720;canvas.height=520;
   const c=canvas.getContext('2d');if(!c)return false;
   c.fillStyle='#172537';c.fillRect(0,0,720,520);
   c.fillStyle='#344456';c.fillRect(20,20,680,480);
   if(grid){c.save();c.beginPath();c.rect(20,20,680,480);c.clip();c.globalAlpha=.17;const pattern=c.createPattern(images.tiles,'repeat');if(pattern){c.fillStyle=pattern;c.fillRect(20,20,680,480);}c.restore();}
   c.strokeStyle='#9ba9b9';c.lineWidth=5;c.strokeRect(20,20,680,480);
   for(const o of arena.obstacles||[]){
    c.fillStyle='#738096';c.fillRect(o.x,o.y,o.w,o.h);
    c.save();c.beginPath();c.rect(o.x,o.y,o.w,o.h);c.clip();c.globalAlpha=.46;
    // Exact obstacle footprint stays apparent even with decorative texture.
    const pat=c.createPattern(images.wall,'repeat');if(pat){c.fillStyle=pat;c.fillRect(o.x,o.y,o.w,o.h);}
    c.restore();c.strokeStyle='#c1cad4';c.lineWidth=1;c.strokeRect(o.x,o.y,o.w,o.h);
   }
   cached={canvas,grid};cache.set(arena,cached);
  }
  ctx.drawImage(cached.canvas,0,0);return true;
 }
 function pawn(ctx,{x,y,r,label,color}){
  ctx.save();
  // Keep original team outline; use the same neutral pawn art for all teams.
  ctx.drawImage(images.pawn,x-r*1.45,y-r*1.45,r*2.9,r*2.9);
  ctx.font='bold '+Math.max(10,Math.round(r*.85))+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='#172537';ctx.fillText(label,x,y);
  ctx.restore();
 }
 return {load,active,terrain,pawn};
}
