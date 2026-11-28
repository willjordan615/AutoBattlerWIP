import {loadGuest,invalidateGuest} from './guest-client.js?v=2026-11-28-courtyard-502';
async function accountRequest(action,data){
 const res=await fetch('./api/account/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(10000)});
 const value=await res.json();if(!res.ok)throw Error(typeof value.error==='string'?value.error:'Account request failed');return value;
}
export function setupAccounts({onIdentityChange,onNameChange,onBeforeChange,onBusy,canChange=()=>true}={}){
 const $=id=>document.getElementById(id);
 const panel=$('accountPanel'),status=$('accountStatus'),input=$('accountCode'),recovery=$('accountRecoveryCode');
 const create=$('createAccount'),signIn=$('signInAccount'),signOut=$('signOutAccount'),remove=$('deleteAccount'),copy=$('copyAccountCode'),dismiss=$('dismissAccountCode');
 const nameInput=$('displayNameInput'),rename=$('saveDisplayName');
 let current=null,busy=false;
 const tell=text=>{status.textContent=text;};
 function render(){
  const signed=!!current?.account;
  $('accountGuestActions').hidden=signed;signIn.hidden=signed;$('accountSignedActions').hidden=!signed;
  $('accountCodeLabel').textContent=signed?'Recovery code (required to delete account)':'Recovery code';
  for(const button of [create,signIn,signOut,remove])button.disabled=busy||!current;
  input.disabled=busy||!current;
  rename.disabled=busy||!signed;nameInput.disabled=busy||!signed;
  $('displayNameCurrent').textContent=signed?current.name:'';
 }
 function hideRecovery(){recovery.value='';$('accountRecovery').hidden=true;}
 async function refresh(){if(busy)return;try{invalidateGuest();current=await loadGuest();tell(current.name+' · '+(current.account?'Account':'Guest'));}catch{current=null;tell('Account service unavailable. Guest Solo remains available.');}render();}
 async function change(action,data={}){
  if(busy||!current||!canChange())return;
  busy=true;onBusy?.(true);render();hideRecovery();input.value='';
  try{
   onBeforeChange?.();
   const result=await accountRequest(action,data);
   invalidateGuest();
   current=result.account?{account:true,name:result.name}:null;
   // Immediately discard counters and cached identity from the old profile.
   onIdentityChange?.(current);
   if(!current){try{current=await loadGuest();}catch{}}
   if(result.recoveryCode){recovery.value=result.recoveryCode;$('accountRecovery').hidden=false;tell('Account created. Save your recovery code before leaving this page.');}
   else tell(current?current.name+' · '+(current.account?'Account':'Guest'):'Profile changed. Reload if unavailable.');
  }catch(e){tell(e.message||'Account request failed.');}
  finally{busy=false;onBusy?.(false);render();}
 }
 function code(){const value=input.value.trim();if(!/^ab1_[A-Za-z0-9_-]{43}$/.test(value)){tell('Enter the complete recovery code.');return null;}return value;}
 rename.onclick=async()=>{
  if(busy||!current?.account||!canChange())return;
  const name=nameInput.value.trim();
  if(!/^[A-Za-z][A-Za-z0-9_]{2,15}$/.test(name)){tell('Use 3–16 characters, starting with a letter. Letters, digits and underscores only.');return;}
  busy=true;onBusy?.(true);render();
  try{
   const result=await accountRequest('rename',{name});
   invalidateGuest();current={account:true,name:result.name};nameInput.value='';
   onNameChange?.(current);tell('Display name saved: '+current.name);
  }catch(e){tell(e.message||'Name change failed.');}
  finally{busy=false;onBusy?.(false);render();}
 };
 create.onclick=()=>{if(globalThis.confirm('Create an optional account and move any saved Quick Play history into it?'))change('create');};
 signIn.onclick=()=>{const value=code();if(value)change('sign-in',{code:value});};
 signOut.onclick=()=>change('sign-out');
 remove.onclick=()=>{const value=code();if(value&&globalThis.confirm('Permanently delete this account, its saved online history and all signed-in sessions?'))change('delete',{code:value});};
 copy.onclick=async()=>{try{await navigator.clipboard.writeText(recovery.value);tell('Recovery code copied. Keep it private.');}catch{recovery.select();tell('Select and copy the recovery code.');}};
 dismiss.onclick=()=>{hideRecovery();tell('Recovery code hidden. Keep your saved copy safe.');};
 panel.ontoggle=()=>{if(panel.open)refresh();};
 render();return {refresh};
}
