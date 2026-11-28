// Server-only display name policy. This is a limited English filter, not a
// guarantee against abuse. Never use a display name to authenticate a player.
export const NAME_MIN=3,NAME_MAX=16;
export const RENAME_INTERVAL=24*60*60*1000;
const substitutions={0:'o',1:'i',3:'e',4:'a',5:'s',7:'t',8:'b'};
const blocked=['fuck','shit','bitch','cunt','dick','pussy','whore','slut','nigger','nigga','faggot','kike','chink','spic','retard','nazi','hitler','rape','porn','pedo','kill yourself','kys'];
const reserved=/^(?:admin|administrator|moderator|mod|staff|support|system|official|developer|gamemaster|bot|server|autobattler)(?:[0-9]*)$/i;
const folded=value=>value.toLowerCase().replace(/_/g,'').replace(/[0134578]/g,c=>substitutions[c]);
const compactBlocked=blocked.map(s=>s.replace(/ /g,''));
export function validateDisplayName(value){
 if(typeof value!=='string'||value.length<NAME_MIN||value.length>NAME_MAX||!/^[A-Za-z][A-Za-z0-9_]*$/.test(value))
  return {ok:false,error:'Use 3–16 characters: start with a letter; letters, digits and underscores only.'};
 const compact=folded(value),plain=value.toLowerCase().replace(/_/g,'');
 const variants=[compact,plain,compact.replace(/(.)\1{2,}/g,'$1')];
 if(reserved.test(plain)||reserved.test(compact)||/^(?:admin|moderator|staff|support|system|official|bot)[0-9_]*$/i.test(value))
  return {ok:false,error:'This name is reserved. Choose another.'};
 if(variants.some(s=>compactBlocked.some(word=>s.includes(word)))||/(?:^|_)ass(?:_|$)/i.test(value))
  return {ok:false,error:'This name is not allowed. Choose another.'};
 return {ok:true,name:value};
}
