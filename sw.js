/* Tally service worker — build ed6617962707
   The whole app is one HTML file plus four fonts, so everything is precached on install and the
   app runs with no network at all afterwards. That is the point: a training log you cannot open
   on a bad connection is worse than useless in a gym basement.

   The page is served cache-first and refreshed in the background, so a launch is instant and the
   next launch picks up a new build. skipWaiting + clients.claim mean an update lands without the
   user having to close every tab. */
const CACHE='tally-ed6617962707';
const ASSETS=[
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon.svg",
  "./icon-maskable.svg",
  "./fonts/Archivo.woff2",
  "./fonts/Bangers.woff2",
  "./fonts/JetBrainsMono.woff2",
  "./fonts/NotoSansThai.woff2"
];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('fetch', function(e){
  var req=e.request;
  if(req.method!=='GET') return;
  if(new URL(req.url).origin!==self.location.origin) return;   // never touch anything off-origin
  e.respondWith(
    caches.match(req).then(function(hit){
      var net=fetch(req).then(function(res){
        if(res && res.status===200 && res.type==='basic'){
          var copy=res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){ return hit; });                      // offline: whatever we have
      return hit || net;                                        // cached first, refreshed behind it
    })
  );
});
