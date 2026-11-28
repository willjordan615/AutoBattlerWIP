import {PRESETS,loadSettings,saveSettings} from './performance-settings.js?v=2026-11-28-illustrated-menus-503';
export function createSettingsUI({onChange,onPreview}={}){
 let settings=loadSettings(),recommended=null;
 const $=id=>document.getElementById(id);
 function show(){
  $('soundEnabled').checked=settings.soundEnabled;$('musicEnabled').checked=settings.musicEnabled;$('musicVolume').value=String(settings.musicVolume);$('musicVolumeValue').textContent=settings.musicVolume+'%';$('combatVolume').value=String(settings.combatVolume);$('interfaceVolume').value=String(settings.interfaceVolume);$('combatVolumeValue').textContent=settings.combatVolume+'%';$('interfaceVolumeValue').textContent=settings.interfaceVolume+'%';$('previewSound').disabled=!settings.soundEnabled||(!settings.interfaceVolume&&!settings.combatVolume);$('visualTheme').value=settings.theme;$('graphicsPreset').value=settings.preset;$('reducedMotion').checked=settings.reducedMotion;$('keepAwake').checked=settings.keepAwake;
  const p=PRESETS[settings.preset];
  $('settingsDescription').textContent=p.fps+' FPS target · '+Math.round(p.scale*100)+'% arena resolution · '+(p.afterimages?'standard':'minimal')+' effects';
  $('settingsRecommendation').textContent=recommended?'Rendering is struggling. Consider '+(recommended==='saver'?'Battery saver':'Balanced')+'.':'Performance recommendations appear after sustained slow rendering.';
  $('applyRecommendation').hidden=!recommended||recommended===settings.preset;
 }
 function update(value){settings=saveSettings(value);recommended=null;show();onChange?.(settings);}
 function recommend(value){if(value&&value!==settings.preset){recommended=value;show();}}
 $('soundEnabled').onchange=()=>update({...settings,soundEnabled:$('soundEnabled').checked});
 $('musicEnabled').onchange=()=>update({...settings,musicEnabled:$('musicEnabled').checked});
 for(const id of ['combatVolume','interfaceVolume','musicVolume'])$(id).oninput=()=>update({...settings,[id]:Number($(id).value)});
 $('previewSound').onclick=()=>onPreview?.($('audioPreviewCue').value||'confirm');
 $('visualTheme').onchange=()=>update({...settings,theme:$('visualTheme').value});
 $('graphicsPreset').onchange=()=>update({...settings,preset:$('graphicsPreset').value});
 $('keepAwake').onchange=()=>update({...settings,keepAwake:$('keepAwake').checked});
 $('reducedMotion').onchange=()=>update({...settings,reducedMotion:$('reducedMotion').checked});
 $('applyRecommendation').onclick=()=>{if(recommended)update({...settings,preset:recommended});};
 $('resetGraphics').onclick=()=>update({...settings,preset:'balanced',reducedMotion:!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches});
 show();return {get:()=>settings,recommend};
}
