const CACHE_NAME = 'hi-vault-v1.2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&family=Manrope:wght@600;700;800&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js',
  'https://unpkg.com/html5-qrcode'
];

// ===== INDEXEDDB WRAPPER =====
const DB_NAME = 'hv_db';
const DB_VERSION = 1;

function getDB() {
  return new Promise((resolve, reject) => {
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('config')) db.createObjectStore('config');
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id' });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

function dbGet(store, key) {
  return getDB().then(db => {
    return new Promise(resolve => {
      var tx = db.transaction(store, 'readonly');
      var req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  });
}

function dbDelete(store, key) {
  return getDB().then(db => {
    return new Promise(resolve => {
      var tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
    });
  });
}

function dbGetAll(store) {
  return getDB().then(db => {
    return new Promise(resolve => {
      var tx = db.transaction(store, 'readonly');
      var req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  });
}

// ===== PWA SERVICE WORKER EVENT LISTENERS =====
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then(response => {
        if (e.request.url.includes('fonts.gstatic.com') || e.request.url.includes('fonts.googleapis.com')) {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(e.request, response.clone());
            return response;
          });
        }
        return response;
      });
    })
  );
});

// ===== BACKGROUND SYNC =====
self.addEventListener('sync', event => {
  if (event.tag === 'sync-hv-vault') {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  try {
    var apiUrl = await dbGet('config', 'api_url');
    var user = await dbGet('config', 'user');
    var pw = await dbGet('config', 'pw');
    if (!apiUrl || !user || !pw) return;

    var queue = await dbGetAll('queue');
    if (queue.length === 0) return;

    for (var i = 0; i < queue.length; i++) {
      var item = queue[i];
      var url = apiUrl + '?action=' + encodeURIComponent(item.action) + '&user=' + encodeURIComponent(user) + '&pw=' + encodeURIComponent(pw);
      if (item.params) {
        for (var k in item.params) {
          url += '&' + encodeURIComponent(k) + '=' + encodeURIComponent(item.params[k]);
        }
      }
      try {
        var res = await fetch(url);
        if (res.ok) {
          var d = await res.json();
          if (d.success) {
            await dbDelete('queue', item.id);
          }
        }
      } catch (err) {
        // Stop queue loop if connection fails again
        break;
      }
    }
  } catch (err) {
    console.error('Background sync failed:', err);
  }
}
