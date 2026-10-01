const V='atable-v1';
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(['/','/manifest.webmanifest']))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x))))));
// Réseau d'abord, cache en secours. Jamais d'API ni de POST : une commande n'est donc jamais « confirmée » hors connexion.
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.pathname.startsWith('/api/')||u.origin!==location.origin)return;
e.respondWith(fetch(r).then(x=>{if(x.ok){const c=x.clone();caches.open(V).then(h=>h.put(r,c))}return x}).catch(()=>caches.match(r).then(m=>m||caches.match('/'))))});
