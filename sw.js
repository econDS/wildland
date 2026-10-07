'use strict';
// Offline cache for the GitHub Pages build. scripts/build-web.mjs fills in the
// cache name and asset list; this file is not used by the Android app.
const CACHE='__CACHE_NAME__';
const ASSETS=__ASSETS__;

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key.startsWith('wildland-')&&key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==location.origin)return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(request,{ignoreSearch:true})||(request.mode==='navigate'&&await cache.match('./'));
    return cached||fetch(request);
  }));
});
