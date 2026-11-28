(function(){
 // The old static public link opens the same hosted game as Quick Play.
 if(location.hostname==='willjordan615.github.io'&&location.pathname.startsWith('/AutoBattlerWIP')){location.replace('https://quick-play-production-4fff294f.up.railway.app/');return;}
 const current='2026-11-28-accounts-420';
 const url=new URL(location.href);
 const already=url.searchParams.get('build');
 // A stale HTML shell can still run this inline checker.
 fetch('./build.json?check='+Date.now(),{cache:'no-store'})
  .then(r=>{if(!r.ok)throw Error('Version check unavailable');return r.json()})
  .then(data=>{
   if(typeof data.version!=='string'||!data.version)return;
   if(data.version!==current&&already!==data.version){
    url.searchParams.set('build',data.version);
    location.replace(url.toString());
   }
  }).catch(()=>{});
})();
