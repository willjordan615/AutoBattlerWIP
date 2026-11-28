import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,sep,extname} from 'node:path';
import {createQuickPlay,QuickError} from './quick-play.js';
import {createPlaytestSink} from './playtest.js';
import {createGuests} from './guest.js';
import {openHistory} from './history.js';
import {mkdirSync} from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json; charset=utf-8','.ogg':'audio/ogg','.wav':'audio/wav'};
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
function json(res,status,value){res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
async function body(req){
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new QuickError(415,'Expected JSON');
 let n=0,parts=[];
 for await(const chunk of req){n+=chunk.length;if(n>2048)throw new QuickError(413,'Request too large');parts.push(chunk);}
 try{const value=JSON.parse(Buffer.concat(parts).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{throw new QuickError(400,'Invalid JSON');}
}
export function createApp({history=openHistory(),service=createQuickPlay({onFinished:e=>history.record(e.guestId,e.matchId,e.match,e.seat,e.joinedAt)}),pulseMs=100,playtest=createPlaytestSink(),guests=createGuests()}={}){
 let limitStart=Date.now(),guestRequests=0,historyWrites=0,accountWrites=0;
 const accounts=history.accounts;
 const accountFor=req=>accounts.read(req.headers.cookie);
 const identity=req=>{const a=accountFor(req);return a?{...guests.describe(a.id),name:a.name,account:true}:guests.read(req.headers.cookie);};
 const requireIdle=id=>{if(id&&service.hasActiveGuest?.(id))throw new QuickError(409,'Finish or leave Quick Play before switching profiles.');};
 function budget(kind){const t=Date.now();if(t-limitStart>=60000){limitStart=t;guestRequests=historyWrites=accountWrites=0;}if(kind==='guest'?++guestRequests>120:kind==='account'?++accountWrites>60:++historyWrites>120)throw new QuickError(429,'Try again shortly');}
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost'),path=url.pathname;
   if(path.startsWith('/api/')){
    if(['cross-site','same-site'].includes(req.headers['sec-fetch-site']))throw new QuickError(403,'Cross-origin request rejected');
    if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{throw new QuickError(403,'Invalid origin');}if(origin.host!==req.headers.host)throw new QuickError(403,'Cross-origin request rejected');}
   }
   if(path==='/api/account'||path.startsWith('/api/account/')){
    if(path==='/api/account'&&req.method==='GET'){const a=accountFor(req);return json(res,200,{account:!!a,...(a?{name:a.name}:{})});}
    if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
    budget('account');const v=await body(req);
    // Authenticate after the asynchronous body read, immediately before writes.
    const account=accountFor(req),guest=identity(req);
    const exact=keys=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
    if(path==='/api/account/create'){
     if(!exact([]))throw new QuickError(400,'Expected an empty request');
     if(account)throw new QuickError(409,'Already signed in');
     if(!guest)throw new QuickError(401,'Guest profile required');
     requireIdle(guest.id);
     const result=accounts.create(guest);if(!result)throw new QuickError(503,'Account capacity reached');
     res.setHeader('Set-Cookie',result.cookie);return json(res,201,{account:true,name:result.account.name,recoveryCode:result.code});
    }
    if(path==='/api/account/sign-in'){
     if(!exact(['code'])||typeof v.code!=='string')throw new QuickError(400,'Expected a recovery code');
     if(account)throw new QuickError(409,'Sign out first');
     requireIdle(guest?.id);
     const result=accounts.signIn(v.code);if(!result)throw new QuickError(401,'Invalid recovery code');
     res.setHeader('Set-Cookie',result.cookie);return json(res,200,{account:true,name:result.account.name});
    }
    if(path==='/api/account/rename'){
     if(!exact(['name'])||typeof v.name!=='string')throw new QuickError(400,'Expected a display name');
     if(!account)throw new QuickError(401,'Sign in first');
     requireIdle(account.id);
     const result=accounts.rename(account.id,v.name);
     if(result.status!==200)throw new QuickError(result.status,result.error);
     return json(res,200,{account:true,name:result.name});
    }
    if(path==='/api/account/sign-out'){
     if(!exact([]))throw new QuickError(400,'Expected an empty request');
     requireIdle(account?.id);res.setHeader('Set-Cookie',accounts.signOut(req.headers.cookie));return json(res,200,{account:false});
    }
    if(path==='/api/account/delete'){
     if(!exact(['code'])||typeof v.code!=='string')throw new QuickError(400,'Expected a recovery code');
     if(!account)throw new QuickError(401,'Sign in first');
     requireIdle(account.id);
     if(!accounts.deleteAccount(account.id,v.code))throw new QuickError(401,'Invalid recovery code');
     res.setHeader('Set-Cookie',accounts.signOut(req.headers.cookie));return json(res,200,{account:false});
    }
    return json(res,404,{error:'Unknown endpoint'});
   }
   if(path==='/api/history'){
    const guest=identity(req);if(!guest)throw new QuickError(401,'Guest profile required');
    if(req.method==='GET')return json(res,200,history.read(guest.id));
    if(req.method==='POST'){
     budget('history');const v=await body(req);if(Object.keys(v).length!==1||typeof v.enabled!=='boolean')throw new QuickError(400,'Expected a history preference');
     if(identity(req)?.id!==guest.id)throw new QuickError(401,'Profile session changed');
     const result=history.set(guest.id,v.enabled);if(!result)throw new QuickError(503,'History capacity reached');return json(res,200,result);
    }return json(res,405,{error:'Method not allowed'});
   }
   if(path==='/api/guest'&&req.method==='POST'){
    budget('guest');
    if(req.headers['sec-fetch-site']==='cross-site')throw new QuickError(403,'Cross-site request rejected');
    await body(req);
    const account=accountFor(req);if(account)return json(res,200,{name:account.name,account:true});
    const {profile,cookie}=guests.issue(guests.read(req.headers.cookie));
    res.setHeader('Set-Cookie',cookie);return json(res,200,{name:profile.name});
   }
   if((path==='/api/playtest'||path==='/api/playtest/guest')&&req.method==='POST'){
    if(req.headers['sec-fetch-site']==='cross-site')throw new QuickError(403,'Cross-site request rejected');
    const status=playtest(await body(req),path==='/api/playtest/guest'?identity(req)?.analyticsId:undefined);return json(res,status,{ok:status===200});
   }
   if(path.startsWith('/api/quick/')){
    if(req.headers['sec-fetch-site']==='cross-site')throw new QuickError(403,'Cross-site request rejected');
    const guest=identity(req);
    if(!guest)throw new QuickError(401,'Guest profile required. Reload the game and allow first-party cookies.');
    const auth=req.headers.authorization||'',id=auth.startsWith('Bearer ')?auth.slice(7):'';
    if(path==='/api/quick/join'&&req.method==='POST'){const v=await body(req);if(identity(req)?.id!==guest.id)throw new QuickError(401,'Profile session changed');return json(res,200,service.join(v.type,guest));}
    if(path==='/api/quick/state'&&req.method==='GET')return json(res,200,service.get(id,url.searchParams.has('revision')?Number(url.searchParams.get('revision')):undefined,guest.id));
    if(path==='/api/quick/pick'&&req.method==='POST'){const v=await body(req);if(identity(req)?.id!==guest.id)throw new QuickError(401,'Profile session changed');return json(res,200,service.pick(id,v,guest.id));}
    if(path==='/api/quick/leave'&&req.method==='POST')return json(res,200,service.leave(id,guest.id));
    return json(res,404,{error:'Unknown endpoint'});
   }
   if(path==='/health'&&req.method==='GET')return json(res,200,{ok:true});
   if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
   const p=decodeURIComponent(path==='/'?'/index.html':path);
   if(!/^\/(?:index\.html|style\.css|presentation\.css|assets\/art\/(?:(?:keep|grain|bruiser|rogue|ranged)\.svg|(?:bruiser|rogue|ranged)-painted\.webp)|build\.json|src\/[a-zA-Z0-9_/-]+\.js|assets\/audio\/(?:(?:hazard|guard|click|confirm|start|finish)\.wav|(?:heavy|light|pluck|miss|impact|utility|music)\.ogg))$/.test(p))return json(res,404,{error:'Not found'});
   const file=resolve(root,'.'+p);if(!file.startsWith(root.endsWith(sep)?root:root+sep))return json(res,404,{error:'Not found'});
   let data;try{data=await readFile(file);}catch{return json(res,404,{error:'Not found'});}
   res.writeHead(200,{...headers,'Content-Type':MIME[extname(file)]});res.end(req.method==='HEAD'?undefined:data);
  }catch(e){if(e instanceof QuickError)return json(res,e.status,{error:e.message});console.error('Request processing failed');json(res,500,{error:'Service temporarily unavailable'});}
 });
 const timer=setInterval(()=>{try{service.pump();}catch(e){console.error(e);}},pulseMs);timer.unref();server.on('close',()=>{clearInterval(timer);history.close();});
 server.requestTimeout=10000;server.headersTimeout=10000;
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.env.RAILWAY_ENVIRONMENT_ID&&!process.env.GUEST_SIGNING_KEY)throw Error('Configure GUEST_SIGNING_KEY before starting Railway');const dir=process.env.RAILWAY_VOLUME_MOUNT_PATH||process.env.HISTORY_DATA_DIR;if(process.env.RAILWAY_ENVIRONMENT_ID&&!dir)throw Error('Persistent history volume required');if(dir)mkdirSync(dir,{recursive:true});const history=openHistory(dir?resolve(dir,'history.sqlite'):':memory:');const port=Number(process.env.PORT||3000);createApp({history}).listen(port,'0.0.0.0',()=>console.log('Quick Play listening on '+port));}
