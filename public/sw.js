const version='nulife-offline-2';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(version).then(cache=>cache.addAll(['/offline.html','/icon-192.png'])));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('nulife-offline-')&&key!==version).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.mode==='navigate') event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));
});
