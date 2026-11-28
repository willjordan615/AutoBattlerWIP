import {PRESETS,loadSettings,saveSettings} from './performance-settings.js?v=2026-11-28-classic-395';
export function createSettingsUI({onChange}={}){
 let settings=loadSettings(),recommended=null;
 const $=id=>document.getElementById(id);
 function show(){
  $('graphicsPreset').value=settings.preset;$('reducedMotion').checked=settings.reducedMotion;$('keepAwake').checked=settings.keepAwake;
  const p=PRESETS[settings.preset];
  $('settingsDescription').textContent=p.fps+' FPS target · '+Math.round(p.scale*100)+'% arena resolution · '+(p.afterimages?'standard':'minimal')+' effects';
  $('settingsRecommendation').textContent=recommended?'Rendering is struggling. Consider '+(recommended==='saver'?'Battery saver':'Balanced')+'.':'Performance recommendations appear after sustained slow rendering.';
  $('applyRecommendation').hidden=!recommended||recommended===settings.preset;
 }
 function update(value){settings=saveSettings(value);recommended=null;show();onChange?.(settings);}
 function recommend(value){if(value&&value!==settings.preset){recommended=value;show();}}
 $('graphicsPreset').onchange=()=>update({...settings,preset:$('graphicsPreset').value});
 $('keepAwake').onchange=()=>update({...settings,keepAwake:$('keepAwake').checked});
 $('reducedMotion').onchange=()=>update({...settings,reducedMotion:$('reducedMotion').checked});
 $('applyRecommendation').onclick=()=>{if(recommended)update({...settings,preset:recommended});};
 $('resetGraphics').onclick=()=>update({preset:'balanced',keepAwake:settings.keepAwake});
 show();return {get:()=>settings,recommend};
}
