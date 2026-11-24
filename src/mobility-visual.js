// Lightweight Canvas-only afterimages for discrete movement utilities.
// Pure rendering: no timers, particles, allocations or simulation changes.
export const AFTERIMAGE_ABILITIES=['dash','dodge','backstep','flank','intercept'];
export const AFTERIMAGE_DURATION=.26;
// Precomputed 22% darker versions of the arena team colors.
const TEAM_FILLS={'#64b3ff':'#4e8cc7','#f58086':'#bf6469','#f4d16f':'#bea357','#d3a2ff':'#a57ec7'};
export function teamFill(color){return TEAM_FILLS[color]||color;}
export function isUtilityAfterimage(event){
 return event?.kind==='mobility'&&AFTERIMAGE_ABILITIES.includes(event.ability);
}
export function drawUtilityAfterimage(ctx,event,progress,colors,chassis){
 if(!isUtilityAfterimage(event))return false;
 const archetype=chassis[event.type];
 if(!archetype)return false;
 const fade=Math.max(0,1-Math.min(1,progress));
 if(fade<=0)return false;
 const r=archetype.radius,teamColor=colors[event.owner]||'#ffffff';
 ctx.save();
 // Small motion cue connects the afterimage to its new position.
 ctx.globalAlpha=fade*.19;
 ctx.strokeStyle=teamColor;
 ctx.lineWidth=3;
 ctx.beginPath();ctx.moveTo(event.x,event.y);ctx.lineTo(event.toX,event.toY);ctx.stroke();
 // A ghost of the actual fighter token marks the origin. Keep this recognizable
 // on mobile without adding a second living unit, health bar or collision.
 ctx.globalAlpha=fade*.52;
 ctx.fillStyle=teamColor;
 ctx.beginPath();ctx.arc(event.x,event.y,r+4,0,Math.PI*2);ctx.fill();
 ctx.globalAlpha=fade*.40;
 ctx.fillStyle=teamFill(teamColor);
 ctx.beginPath();ctx.arc(event.x,event.y,r-1,0,Math.PI*2);ctx.fill();
 ctx.globalAlpha=fade*.58;
 ctx.fillStyle='#ffffff';
 ctx.font='bold 12px system-ui';
 ctx.textAlign='center';
 ctx.fillText(event.type==='bruiser'?'B':event.type==='rogue'?'R':'A',event.x,event.y+4);
 ctx.restore();
 return true;
}
