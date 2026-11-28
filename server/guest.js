import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
const COOKIE='ab_guest';
const TTL=365*24*60*60;
const adjectives=['Amber','Azure','Brisk','Calm','Clever','Cloudy','Copper','Coral','Dapper','Dawn','Dusty','Golden','Jade','Kind','Lively','Lunar','Mellow','Mint','Misty','Quiet','Ruby','Sable','Silver','Soft','Sunny','Swift','Velvet','Violet','Wild','Winter'];
const animals=['Badger','Bear','Bison','Crane','Dolphin','Finch','Fox','Gecko','Heron','Hare','Koala','Lark','Lynx','Marten','Mole','Newt','Otter','Owl','Panda','Pika','Quail','Raven','Robin','Seal','Sparrow','Stag','Stoat','Tern','Wolf','Wren'];
export function createGuests({key=process.env.GUEST_SIGNING_KEY||randomBytes(32).toString('hex'),secure=!!process.env.RAILWAY_ENVIRONMENT_ID,now=Date.now}={}){
 if(typeof key!=='string'||key.length<32)throw Error('Guest signing key must be at least 32 characters');
 const mac=(domain,value)=>createHmac('sha256',key).update(domain+'\0'+value).digest('hex');
 const describe=id=>{
  const b=Buffer.from(mac('name',id),'hex');
  return {id,name:adjectives[b[0]%adjectives.length]+animals[b[1]%animals.length]+'-'+String(b.readUInt32BE(2)%100000).padStart(5,'0'),analyticsId:mac('analytics',id).slice(0,32)};
 };
 function read(header=''){
  const raw=header.split(';').map(v=>v.trim()).find(v=>v.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if(!raw||!/^v1\.[a-f0-9]{64}\.[0-9]{1,12}\.[a-f0-9]{64}$/.test(raw))return null;
  const [version,id,expiry,sig]=raw.split('.');
  if(Number(expiry)<=Math.floor(now()/1000))return null;
  const expected=mac('cookie',version+'.'+id+'.'+expiry);
  if(!timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(expected,'hex')))return null;
  return describe(id);
 }
 function issue(existing=null){
  const profile=existing||describe(randomBytes(32).toString('hex'));
  const payload='v1.'+profile.id+'.'+(Math.floor(now()/1000)+TTL);
  const cookie=COOKIE+'='+payload+'.'+mac('cookie',payload)+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+TTL+(secure?'; Secure':'');
  return {profile,cookie};
 }
 return {read,issue,describe};
}
