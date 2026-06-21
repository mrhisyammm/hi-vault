/* ===== INDEXEDDB WRAPPER ===== */
const DB_NAME = 'hv_db';
const DB_VERSION = 1;

function getDB() {
  return new Promise(function(resolve, reject) {
    var req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('config')) db.createObjectStore('config');
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id' });
    };
    req.onsuccess = function(e) { resolve(e.target.result); };
    req.onerror = function(e) { reject(e.target.error); };
  });
}

function dbGet(store, key) {
  return getDB().then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction(store, 'readonly');
      var req = tx.objectStore(store).get(key);
      req.onsuccess = function() { resolve(req.result); };
      req.onerror = function() { resolve(null); };
    });
  });
}

function dbPut(store, key, val) {
  return getDB().then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(val, key);
      tx.oncomplete = function() { resolve(); };
    });
  });
}

function dbDelete(store, key) {
  return getDB().then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = function() { resolve(); };
    });
  });
}

function dbGetAll(store) {
  return getDB().then(function(db) {
    return new Promise(function(resolve) {
      var tx = db.transaction(store, 'readonly');
      var req = tx.objectStore(store).getAll();
      req.onsuccess = function() { resolve(req.result || []); };
      req.onerror = function() { resolve([]); };
    });
  });
}

/* ===== CRYPTO ENCRYPTION (AES-GCM 256-bit) ===== */
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptData(plaintext, password, salt) {
  try {
    const key = await deriveKey(password, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(plaintext));
    const ivBase64 = btoa(String.fromCharCode.apply(null, iv));
    const ciphertextBase64 = btoa(String.fromCharCode.apply(null, new Uint8Array(ciphertext)));
    return ivBase64 + ":" + ciphertextBase64;
  } catch(e) {
    console.error("Encryption failed:", e);
    return "";
  }
}

async function decryptData(encryptedStr, password, salt) {
  try {
    const parts = encryptedStr.split(":");
    if (parts.length !== 2) throw new Error("Invalid encrypted format");
    const iv = new Uint8Array(atob(parts[0]).split("").map(c => c.charCodeAt(0)));
    const ciphertext = new Uint8Array(atob(parts[1]).split("").map(c => c.charCodeAt(0)));
    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch(e) {
    console.error("Decryption failed:", e);
    return "";
  }
}
