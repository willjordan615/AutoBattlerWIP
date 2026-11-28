import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,sep,extname} from 'node:path';
import {createQuickPlay,QuickError} from './quick-play.js';
import {createPlaytestSink} from './playtest.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
function json(res,status,value){res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
async function body(req){
 if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new QuickError(415,'Expected JSON');
 let n=0,parts=[];
 for await(const chunk of req){n+=chunk.length;if(n>2048)throw new QuickError(413,'Request too large');parts.push(chunk);}
 try{const value=JSON.parse(Buffer.concat(parts).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{throw new QuickError(400,'Invalid JSON');}
}
export function createApp({service=createQuickPlay(),pulseMs=100,playtest=createPlaytestSink()}={}){
 const server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost'),path=url.pathname;
   if(path==='/api/playtest'&&req.method==='POST'){
    if(req.headers['sec-fetch-site']==='cross-site')throw new QuickError(403,'Cross-site request rejected');
    const status=playtest(await body(req));return json(res,status,{ok:status===200});
   }
   if(path.startsWith('/api/quick/')){
    if(req.headers['sec-fetch-site']==='cross-site')throw new QuickError(403,'Cross-site request rejected');
    const auth=req.headers.authorization||'',id=auth.startsWith('Bearer ')?auth.slice(7):'';
    if(path==='/api/quick/join'&&req.method==='POST')return json(res,200,service.join((await body(req)).type));
    if(path==='/api/quick/state'&&req.method==='GET')return json(res,200,service.get(id,url.searchParams.has('revision')?Number(url.searchParams.get('revision')):undefined));
    if(path==='/api/quick/pick'&&req.method==='POST')return json(res,200,service.pick(id,await body(req)));
    if(path==='/api/quick/leave'&&req.method==='POST')return json(res,200,service.leave(id));
    return json(res,404,{error:'Unknown endpoint'});
   }
   if(path==='/health'&&req.method==='GET')return json(res,200,{ok:true});
   if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
   const p=decodeURIComponent(path==='/'?'/index.html':path);
   if(!/^\/(?:index\.html|style\.css|build\.json|src\/[a-zA-Z0-9_/-]+\.js)$/.test(p))return json(res,404,{error:'Not found'});
   const file=resolve(root,'.'+p);if(!file.startsWith(root.endsWith(sep)?root:root+sep))return json(res,404,{error:'Not found'});
   let data;try{data=await readFile(file);}catch{return json(res,404,{error:'Not found'});}
   res.writeHead(200,{...headers,'Content-Type':MIME[extname(file)]});res.end(req.method==='HEAD'?undefined:data);
  }catch(e){if(e instanceof QuickError)return json(res,e.status,{error:e.message});console.error(e);json(res,500,{error:'Quick Play temporarily unavailable'});}
 });
 const timer=setInterval(()=>{try{service.pump();}catch(e){console.error(e);}},pulseMs);timer.unref();server.on('close',()=>clearInterval(timer));
 server.requestTimeout=10000;server.headersTimeout=10000;
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const port=Number(process.env.PORT||3000);createApp().listen(port,'0.0.0.0',()=>console.log('Quick Play listening on '+port));}
