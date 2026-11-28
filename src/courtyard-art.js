// Original, low-contrast tactical surface. Cached by standee-renderer, no simulation RNG.
// Keep all visual boundaries aligned to their existing logical footprints.
export function paintCourtyard(c,arena,detail=true){
 c.fillStyle='#252b2c';c.fillRect(0,0,720,520);
 c.save();c.beginPath();c.rect(20,20,680,480);c.clip();
 const floor=c.createLinearGradient(20,20,700,500);floor.addColorStop(0,'#484d49');floor.addColorStop(1,'#3e4543');c.fillStyle=floor;c.fillRect(20,20,680,480);
 if(detail){
  c.strokeStyle='rgba(22,29,28,.22)';c.lineWidth=1;c.beginPath();
  for(let j=0;j<8;j++){const y=20+j*60;c.moveTo(20,y);c.lineTo(700,y);for(let x=20-(j%2)*40;x<700;x+=80){c.moveTo(x,y);c.lineTo(x,y+60)}}
  c.stroke();
  c.strokeStyle='rgba(192,176,132,.09)';c.lineWidth=1.5;for(const r of [79,86]){c.beginPath();c.arc(360,260,r,0,Math.PI*2);c.stroke()}
 }
 c.restore();
 // Decorative frame is outside the playable area.
 c.fillStyle='#393d38';c.fillRect(0,0,720,18);c.fillRect(0,502,720,18);c.fillRect(0,18,18,484);c.fillRect(702,18,18,484);
 c.strokeStyle='#92866c';c.lineWidth=1.5;c.strokeRect(19.5,19.5,681,481);
 c.strokeStyle='#52564d';c.lineWidth=1;c.strokeRect(6.5,6.5,707,507);
 for(const o of arena?.obstacles||[]){
  c.save();c.beginPath();c.rect(o.x,o.y,o.w,o.h);c.clip();
  c.fillStyle='#252e2d';c.fillRect(o.x,o.y,o.w,o.h);
  c.fillStyle='#626760';c.fillRect(o.x+2,o.y+2,Math.max(0,o.w-4),Math.max(0,o.h-7));
  c.fillStyle='#82877b';c.fillRect(o.x+2,o.y+2,Math.max(0,o.w-4),3);
  if(detail){c.strokeStyle='rgba(40,47,42,.3)';c.lineWidth=1;c.beginPath();for(let y=o.y+24;y<o.y+o.h-6;y+=24){c.moveTo(o.x+3,y);c.lineTo(o.x+o.w-3,y)}c.stroke()}
  c.strokeStyle='#929487';c.lineWidth=1;c.strokeRect(o.x+.5,o.y+.5,Math.max(0,o.w-1),Math.max(0,o.h-1));c.restore();
 }
}
