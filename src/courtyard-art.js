// Original, deterministic painted courtyard. All artwork is clipped to the actual board or obstacle footprint.
// Only called when the existing cached stage is regenerated; never uses simulation RNG.
const palette=['#817764','#897e68','#93866e','#716e5e','#9b8b73','#827b6b','#746c5d'];
function hash(x,y,s=0){let h=Math.imul(x+103,374761393)^Math.imul(y+61,668265263)^Math.imul(s+11,1274126177);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296}
const pick=(x,y,s=0)=>palette[Math.floor(hash(x,y,s)*palette.length)];
function line(c,points,color,width=1){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.strokeStyle=color;c.lineWidth=width;c.stroke()}
function poly(c,points,color){c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();c.fillStyle=color;c.fill()}
function slab(c,x,y,w,h,i,j,detail=true){
 const a=2+hash(i,j,1)*3,b=2+hash(i,j,2)*4;
 poly(c,[[x+2,y+3],[x+w-a,y+2],[x+w-2,y+b],[x+w-3,y+h-4],[x+w-b,y+h-2],[x+4,y+h-3],[x+2,y+h-a]],pick(i,j));
 line(c,[[x+4,y+h-4],[x+3,y+5],[x+w-a,y+3]],'rgba(244,220,169,.23)',1.4);
 line(c,[[x+w-2,y+b],[x+w-3,y+h-4],[x+4,y+h-2]],'rgba(34,30,25,.37)',1.3);
 if(!detail)return;
 // Tiny stipple and short scuffs, sparse enough to read at phone resolution.
 for(let k=0;k<9;k++){const px=x+6+hash(i,j,10+k*2)*Math.max(0,w-12),py=y+5+hash(i,j,11+k*2)*Math.max(0,h-10);c.fillStyle=k%3?'rgba(53,47,36,.13)':'rgba(245,227,182,.13)';c.fillRect(px,py,2+hash(i,j,k+40)*5,.8+hash(i,j,k+55));}
 if(hash(i,j,5)<.19){const xx=x+w*(.2+.5*hash(i,j,7)),yy=y+h*.42;line(c,[[xx,y+4],[xx-3,yy],[xx+5,yy+5],[xx+2,y+h-3]],'rgba(49,43,34,.32)',.9)}
}
function medallion(c){c.save();c.translate(360,260);c.strokeStyle='rgba(224,205,153,.33)';c.lineWidth=2;
 for(const r of [76,82,94]){c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.stroke()}
 for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);poly(c,[[0,-68],[9,-29],[0,-12],[-9,-29]],'rgba(223,205,158,.20)');line(c,[[0,-94],[0,-84]],'rgba(224,205,153,.45)',2);c.restore()}
 c.restore()
}
function masonry(c,x,y,w,h,detail){
 c.fillStyle='#34352e';c.fillRect(x,y,w,h);c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
 const rows=Math.max(1,Math.ceil((h-5)/25)),rh=(h-5)/rows,cols=Math.max(1,Math.ceil(w/44)),cw=w/cols;
 for(let j=0;j<rows;j++)for(let i=-1;i<=cols;i++)slab(c,x+i*cw+(j%2)*cw/2,y+j*rh,cw,rh,i+Math.floor(x),j+Math.floor(y),detail);
 c.fillStyle='rgba(42,43,35,.48)';c.fillRect(x,y+h-6,w,6);line(c,[[x+1,y+h-1],[x+w-1,y+h-1],[x+w-1,y+1]],'#35372f',2);
 line(c,[[x+1,y+h-2],[x+1,y+1],[x+w-2,y+1]],'#b6a88a',1.2);c.restore();
}
export function paintCourtyard(c,arena,detail=true){
 c.fillStyle='#292e2b';c.fillRect(0,0,720,520);
 c.save();c.beginPath();c.rect(20,20,680,480);c.clip();c.fillStyle='#575348';c.fillRect(20,20,680,480);
 for(let j=0;j<12;j++)for(let i=-1;i<14;i++)slab(c,20+i*57+(j%2)*28.5,20+j*40,57,40,i,j,detail);
 medallion(c);const vignette=c.createRadialGradient(360,242,135,360,260,395);vignette.addColorStop(0,'rgba(37,33,27,0)');vignette.addColorStop(1,'rgba(35,37,30,.38)');c.fillStyle=vignette;c.fillRect(20,20,680,480);c.restore();
 // The border is outside the playable rectangle; no fake obstacles or wall extensions.
 for(let i=0;i<18;i++){const x=i*40;slab(c,x,1,40,19,i,-1,detail);slab(c,x,500,40,19,i,14,detail)}
 for(let j=0;j<12;j++){slab(c,1,20+j*40,19,40,-2,j,detail);slab(c,700,20+j*40,19,40,15,j,detail)}
 c.strokeStyle='#c0ab82';c.lineWidth=1.5;c.strokeRect(19.5,19.5,681,481);
 // Each block retains its exact collision footprint, including the depth cues.
 for(const o of arena?.obstacles||[])masonry(c,o.x,o.y,o.w,o.h,detail);
}
