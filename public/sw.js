const version='nulife-offline-3';
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

self.addEventListener('push',event=>{
  let message;
  try {message=event.data?.json();} catch {return;}
  if(!/^\/(admin|vendor)#(orders|order\/[a-f0-9-]{36})$/.test(message?.url||'')) return;
  event.waitUntil(self.registration.showNotification(message.title,{
    body:message.body, icon:'/icon-192.png',tag:message.tag,data:{url:message.url}
  }));
});
self.addEventListener('notificationclick',event=>{
  const route=event.notification.data?.url;
  event.notification.close();
  if(!/^\/(admin|vendor)#(orders|order\/[a-f0-9-]{36})$/.test(route||'')) return;
  const url=new URL(route,self.location.origin).href;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const open=windows.find(client=>client.url===url);
    if(open) await open.focus();
    else await self.clients.openWindow(url);
  })());
});
