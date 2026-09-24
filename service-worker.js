const CACHE_NAME='monocheck-study-final-v20260924-chart5';
const APP_SHELL=['./','./manifest.json','./progress-chart.js?v=20260924-chart5'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(c=>c.addAll(APP_SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;

  const url=new URL(req.url);

  // Supabase等の外部通信はService Workerで一切処理しない
  if(url.origin!==self.location.origin)return;

  const networkFirst=
    req.mode==='navigate' ||
    /\.(html|js|json)$/.test(url.pathname);

  if(networkFirst){
    event.respondWith(
      fetch(req,{cache:'no-store'})
        .then(res=>{
          if(res&&res.ok){
            const copy=res.clone();
            caches.open(CACHE_NAME).then(c=>c.put(req,copy));
          }
          return res;
        })
        .catch(()=>caches.match(req).then(r=>r||caches.match('./')))
    );
  }else{
    event.respondWith(
      caches.match(req).then(cached=>{
        if(cached)return cached;
        return fetch(req).then(res=>{
          if(res&&res.ok){
            const copy=res.clone();
            caches.open(CACHE_NAME).then(c=>c.put(req,copy));
          }
          return res;
        });
      })
    );
  }
});
