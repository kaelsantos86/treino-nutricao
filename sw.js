const CACHE='treino-nutricao-v1.2.0';
const ASSETS=['./','./index.html','./style.css?v=1.2.0','./app-core.js?v=1.2.0','./app-nutrition.js?v=1.2.0','./app-nutrition-import.js?v=1.2.0','./app-training.js?v=1.2.0','./app-evolution-history.js?v=1.2.0','./app-v1.2.js?v=1.2.0','./app-init.js?v=1.2.0','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});
