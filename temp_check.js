
/* ===== GAS CODE FOR TUTORIAL ===== */
var gasCode=`var WEB_APP_USERNAME = "user";
var WEB_APP_PASSWORD = "password";

function base32Decode(input) {
  if (!input) return [];
  var a = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  var s = input.toString().replace(/[\s=-]/g, "").toUpperCase();
  var bits = "";
  for (var i = 0; i < s.length; i++) {
    var v = a.indexOf(s[i]);
    if (v >= 0) bits += ("00000" + v.toString(2)).slice(-5);
  }
  var bytes = [];
  for (var i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.substring(i, i + 8), 2));
  return bytes;
}

function intToBytes(n) {
  var b = [0,0,0,0,0,0,0,0];
  for (var i = 7; i >= 0; i--) { b[i] = n & 0xff; n = Math.floor(n / 256); }
  return b;
}

function generateTOTP(secret) {
  if (!secret) return "";
  var keyBytes = base32Decode(secret);
  if (keyBytes.length === 0) return "INVALID";
  var counter = Math.floor(Math.floor(new Date().getTime() / 1000) / 30);
  var hmac = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, intToBytes(counter), keyBytes);
  var hash = hmac.map(function(b) { return b < 0 ? b + 256 : b; });
  var o = hash[hash.length - 1] & 0x0f;
  var bin = ((hash[o]&0x7f)<<24)|((hash[o+1]&0xff)<<16)|((hash[o+2]&0xff)<<8)|(hash[o+3]&0xff);
  var code = (bin % 1000000).toString();
  while (code.length < 6) code = "0" + code;
  return code;
}

function TOTP(secret, _refresh) {
  if (!secret || secret === "") return "";
  return generateTOTP(secret.toString().replace(/\s/g, "").toUpperCase());
}

function refreshCodes() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("2FA Vault");
  if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.getRange("Z1").setValue(new Date().getTime());
}

function onEdit(e) {
  try {
    var sheet = e.range.getSheet();
    var name = sheet.getName();
    if (name === "2FA Vault" || name === "Sheet1") {
      var r = e.range.getRow();
      var c = e.range.getColumn();
      if (r >= 3) {
        if (c === 2) {
          var val = e.range.getValue().toString().trim();
          if (val !== "") {
            sheet.getRange(r, 3).setFormula('=IF(B' + r + '="","",TOTP(B' + r + ',Z$1))');
            if (sheet.getRange(r, 4).getValue() === "") sheet.getRange(r, 4).setValue(false);
          }
        }
        if (c === 1) {
          var bVal = sheet.getRange(r, 2).getValue().toString().trim();
          if (bVal !== "" && sheet.getRange(r, 3).getFormula() === "") {
            sheet.getRange(r, 3).setFormula('=IF(B' + r + '="","",TOTP(B' + r + ',Z$1))');
            if (sheet.getRange(r, 4).getValue() === "") sheet.getRange(r, 4).setValue(false);
          }
        }
      }
    }
    if (e.range.getA1Notation() === "A1") {
      refreshCodes();
      SpreadsheetApp.flush();
      e.range.setValue(false);
    }
  } catch(err) {}
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu("🔐 Hi-Vault")
    .addItem("Refresh Codes", "refreshCodes")
    .addItem("Stop Auto-Refresh", "stopAutoRefresh")
    .addToUi();
}

function startAutoRefresh() {
  stopAutoRefresh();
  ScriptApp.newTrigger("refreshCodes").timeBased().everyMinutes(1).create();
}

function stopAutoRefresh() {
  var t = ScriptApp.getProjectTriggers();
  for (var i = 0; i < t.length; i++) if (t[i].getHandlerFunction() === "refreshCodes") ScriptApp.deleteTrigger(t[i]);
}

function _getSheet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("2FA Vault");
  if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  return sheet;
}

function _getNextRow() {
  var sheet = _getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return 3;
  var values = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (values[i][0].toString().trim() === "") {
      return i + 3;
    }
  }
  return values.length + 3;
}

function _getAccounts() {
  var sheet = _getSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return [];
  var data = sheet.getRange(3, 1, lastRow - 2, 4).getValues();
  var accounts = [];
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] && data[i][1]) {
      accounts.push({
        label: data[i][0].toString(),
        secret: data[i][1].toString().replace(/\s/g, "").toUpperCase(),
        fav: data[i][3] === true || data[i][3] === "TRUE",
        row: i + 3
      });
    }
  }
  return accounts;
}

function _addAccount(label, secret) {
  var sheet = _getSheet();
  var newRow = _getNextRow();
  sheet.getRange(newRow, 1).setValue(label);
  sheet.getRange(newRow, 2).setValue(secret.replace(/\s/g, "").toUpperCase());
  sheet.getRange(newRow, 3).setFormula('=IF(B' + newRow + '="","",TOTP(B' + newRow + ',Z$1))');
  sheet.getRange(newRow, 4).setValue(false);
  return { success: true, row: newRow };
}

function _deleteAccount(row) {
  var sheet = _getSheet();
  row = parseInt(row);
  if (row < 3 || row > sheet.getLastRow()) return { success: false, error: "Invalid row" };
  sheet.deleteRow(row);
  var lastRow = sheet.getLastRow();
  for (var i = 3; i <= lastRow; i++) {
    sheet.getRange(i, 3).setFormula('=IF(B' + i + '="","",TOTP(B' + i + ',Z$1))');
  }
  return { success: true };
}

function _toggleFavorite(row) {
  var sheet = _getSheet();
  row = parseInt(row);
  if (row < 3 || row > sheet.getLastRow()) return { success: false, error: "Invalid row" };
  var current = sheet.getRange(row, 4).getValue();
  var newVal = !(current === true || current === "TRUE");
  sheet.getRange(row, 4).setValue(newVal);
  return { success: true, fav: newVal };
}

// REST OF THE API CODE
function _editAccount(row, label, secret) {
  var sheet = _getSheet();
  row = parseInt(row);
  if (row < 3 || row > sheet.getLastRow()) return { success: false, error: "Invalid row" };
  sheet.getRange(row, 1).setValue(label);
  sheet.getRange(row, 2).setValue(secret.replace(/\s/g, "").toUpperCase());
  sheet.getRange(row, 3).setFormula('=IF(B' + row + '="","",TOTP(B' + row + ',Z$1))');
  return { success: true };
}

function _reorderAccounts(newOrder) {
  var sheet = _getSheet();
  var rows = JSON.parse(newOrder);
  if (!Array.isArray(rows) || rows.length === 0) return { success: false, error: "Invalid order" };
  var allData = [];
  for (var i = 0; i < rows.length; i++) {
    var r = parseInt(rows[i]);
    var label = sheet.getRange(r, 1).getValue();
    var secret = sheet.getRange(r, 2).getValue();
    var fav = sheet.getRange(r, 4).getValue();
    allData.push([label, secret, fav]);
  }
  for (var i = 0; i < allData.length; i++) {
    var targetRow = 3 + i;
    sheet.getRange(targetRow, 1).setValue(allData[i][0]);
    sheet.getRange(targetRow, 2).setValue(allData[i][1]);
    sheet.getRange(targetRow, 3).setFormula('=IF(B' + targetRow + '="","",TOTP(B' + targetRow + ',Z$1))');
    sheet.getRange(targetRow, 4).setValue(allData[i][2]);
  }
  return { success: true };
}

function _importAccounts(items) {
  var sheet = _getSheet();
  var startRow = _getNextRow();
  for (var i = 0; i < items.length; i++) {
    var row = startRow + i;
    sheet.getRange(row, 1).setValue(items[i].label);
    sheet.getRange(row, 2).setValue(items[i].secret.replace(/\s/g, "").toUpperCase());
    sheet.getRange(row, 3).setFormula('=IF(B' + row + '="","",TOTP(B' + row + ',Z$1))');
    sheet.getRange(row, 4).setValue(false);
  }
  return { success: true, count: items.length };
}

function _jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _handleRequest(params) {
  var action = params.action || "";
  var user = params.user || "";
  var pw = params.pw || "";
  if (action === "login") {
    return { success: user === WEB_APP_USERNAME && pw === WEB_APP_PASSWORD };
  }
  if (user !== WEB_APP_USERNAME || pw !== WEB_APP_PASSWORD) {
    return { success: false, error: "Unauthorized" };
  }
  switch (action) {
    case "accounts": return { success: true, accounts: _getAccounts() };
    case "add":
      var label = params.label || "";
      var secret = params.secret || "";
      if (!label || !secret) return { success: false, error: "Missing label or secret" };
      return _addAccount(label, secret);
    case "delete":
      var row = params.row;
      if (!row) return { success: false, error: "Missing row" };
      return _deleteAccount(row);
    case "favorite":
      var frow = params.row;
      if (!frow) return { success: false, error: "Missing row" };
      return _toggleFavorite(frow);
    case "edit":
      var erow = params.row;
      var elabel = params.label || "";
      var esecret = params.secret || "";
      if (!erow || !elabel || !esecret) return { success: false, error: "Missing fields" };
      return _editAccount(erow, elabel, esecret);
    case "import":
      var accountsJson = params.accounts;
      if (!accountsJson) return { success: false, error: "Missing accounts data" };
      var items = JSON.parse(accountsJson);
      if (!Array.isArray(items)) return { success: false, error: "Data must be an array" };
      return _importAccounts(items);
    case "reorder":
      var order = params.rows;
      if (!order) return { success: false, error: "Missing rows" };
      return _reorderAccounts(order);
    default:
      return { info: "Hi-Vault API" };
  }
}

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  return _jsonResponse(_handleRequest(params));
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    return _jsonResponse(_handleRequest(body));
  } catch(err) {
    return _jsonResponse({ success: false, error: err.toString() });
  }
}

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  sheet.setName("2FA Vault");
  var maxCols = sheet.getMaxColumns();
  if (maxCols < 26) {
    sheet.insertColumnsAfter(maxCols, 26 - maxCols);
  }
  var maxRows = sheet.getMaxRows();
  if (maxRows < 100) {
    sheet.insertRowsAfter(maxRows, 100 - maxRows);
  }
  var lastRow = Math.max(sheet.getLastRow(), 3);
  var existingData = sheet.getRange(3, 1, lastRow - 2, 4).getValues();
  sheet.clear();
  sheet.getRange("A1:Z" + lastRow).setFontFamily("Google Sans");
  sheet.setRowHeight(1, 32);
  sheet.getRange("A1:D1").setBackground("#e8fce8");
  sheet.getRange("A1").setValue(false);
  sheet.getRange("A1").insertCheckboxes();
  sheet.getRange("A1").setHorizontalAlignment("center").setVerticalAlignment("middle");
  var rl = sheet.getRange("B1:D1"); rl.merge();
  rl.setValue("Check to refresh all OTP codes");
  rl.setFontSize(9).setFontColor("#2d7a2d").setFontWeight("bold").setVerticalAlignment("middle");
  var h = sheet.getRange("A2:D2");
  h.setValues([["Label", "2FA Secret Key", "OTP Code", "Fav"]]);
  h.setFontWeight("bold").setFontSize(10).setFontColor("#ffffff");
  h.setBackground("#1a1a2e").setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.setRowHeight(2, 36);
  h.setBorder(null, null, true, null, null, null, "#6366f1", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.setFrozenRows(2);
  sheet.setColumnWidth(1, 280);
  sheet.setColumnWidth(2, 380);
  sheet.setColumnWidth(3, 130);
  sheet.setColumnWidth(4, 50);
  sheet.getRange("A3:D100").setVerticalAlignment("middle");
  sheet.getRange("A3:A100").setFontFamily("Roboto Mono").setFontSize(14).setFontWeight("bold").setFontColor("#1a1a2e");
  sheet.getRange("B3:B100").setFontFamily("Roboto Mono").setFontSize(9).setFontColor("#888888");
  sheet.getRange("C3:C100").setFontFamily("Roboto Mono").setFontSize(14).setFontWeight("bold")
    .setFontColor("#1a1a2e").setHorizontalAlignment("center").setBackground("#f0f0ff");
  sheet.getRange("D3:D100").setHorizontalAlignment("center");
  for (var i = 3; i <= 100; i++) {
    sheet.setRowHeight(i, 32);
    sheet.getRange("A" + i + ":D" + i).setBackground(i % 2 === 1 ? "#fafafa" : "#ffffff");
  }
  sheet.getRange("A2:D100").setBorder(true, true, true, true, false, true, "#e0e0e0", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(3, 1, existingData.length, 4).setValues(existingData);
  for (var i = 3; i <= 2 + existingData.length; i++) {
    sheet.getRange(i, 3).setFormula('=IF(B' + i + '="","",TOTP(B' + i + ',Z$1))');
    var favVal = sheet.getRange(i, 4).getValue();
    if (favVal === "" || favVal === null) {
      sheet.getRange(i, 4).setValue(false);
    }
  }
  sheet.hideColumns(26);
  sheet.getRange("Z1").setValue(new Date().getTime());
  if (sheet.getMaxColumns() > 4) {
    sheet.hideColumns(5, 21);
  }
  stopAutoRefresh();
  ScriptApp.newTrigger("refreshCodes").timeBased().everyMinutes(1).create();
  SpreadsheetApp.getUi().alert(
    "✅ Hi-Vault ready!\n\n" +
    "Deploy as Web App:\n" +
    "Deploy → New deployment → Web app\n" +
    "Execute as: Me | Access: Anyone"
  );
}`;

function copyGasCode() {
  navigator.clipboard.writeText(gasCode).then(function() {
    showToast('Apps Script code copied to clipboard!');
  });
}

/* ===== STATE ===== */
var accounts=[], codes=[], username='', password='', currentView='accounts';
var sortMode='none'; // none | az | za
var deleteTarget=null;
var CIRC=2*Math.PI*18;
var tickInterval=null;
var dragSrcIndex=null;
var qrDownloadFilename='';
var isLoggedIn=false;

/* ===== ICON MAP ===== */
var IM={'google':{i:'mail',c:'#4285F4'},'gmail':{i:'mail',c:'#EA4335'},'github':{i:'code',c:'#24292e'},'aws':{i:'cloud',c:'#ff9900'},'amazon':{i:'shopping_cart',c:'#ff9900'},'slack':{i:'forum',c:'#4A154B'},'discord':{i:'headset_mic',c:'#5865F2'},'twitter':{i:'alternate_email',c:'#1DA1F2'},'x.com':{i:'alternate_email',c:'#000'},'facebook':{i:'thumb_up',c:'#1877F2'},'meta':{i:'thumb_up',c:'#1877F2'},'microsoft':{i:'window',c:'#00A4EF'},'azure':{i:'cloud_queue',c:'#0078D4'},'apple':{i:'phone_iphone',c:'#555'},'dropbox':{i:'cloud_upload',c:'#0061FF'},'binance':{i:'currency_bitcoin',c:'#F0B90B'},'coinbase':{i:'currency_exchange',c:'#0052FF'},'steam':{i:'sports_esports',c:'#1b2838'},'telegram':{i:'send',c:'#26A5E4'},'whatsapp':{i:'chat',c:'#25D366'},'instagram':{i:'photo_camera',c:'#E4405F'},'linkedin':{i:'work',c:'#0A66C2'},'cloudflare':{i:'security',c:'#F38020'},'digitalocean':{i:'water_drop',c:'#0080FF'},'digital ocean':{i:'water_drop',c:'#0080FF'},'vercel':{i:'deployed_code',c:'#000'},'netlify':{i:'web',c:'#00C7B7'},'stripe':{i:'payments',c:'#635BFF'},'paypal':{i:'account_balance_wallet',c:'#00457C'},'reddit':{i:'forum',c:'#FF4500'},'wordpress':{i:'edit_note',c:'#21759B'},'shopify':{i:'storefront',c:'#7AB55C'},'figma':{i:'draw',c:'#F24E1E'},'notion':{i:'description',c:'#000'},'bitwarden':{i:'key',c:'#175DDC'},'lastpass':{i:'password',c:'#D32D27'},'1password':{i:'lock',c:'#0572EC'},'tiktok':{i:'music_note',c:'#000'},'youtube':{i:'play_circle',c:'#FF0000'},'twitch':{i:'live_tv',c:'#9146FF'},'epic':{i:'sports_esports',c:'#000'},'riot':{i:'sports_esports',c:'#D32936'},'proton':{i:'mail',c:'#6D4AFF'},'okta':{i:'verified_user',c:'#007DC1'},'jira':{i:'bug_report',c:'#0052CC'},'atlassian':{i:'dashboard',c:'#0052CC'},'heroku':{i:'cloud',c:'#430098'}};
function getIcon(label){var l=label.toLowerCase();for(var k in IM)if(l.indexOf(k)!==-1)return IM[k];return{i:'shield_person',c:'var(--primary)'}}

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

/* ===== CRYPTO ENCRYPTION (AES-GCM) ===== */
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256"
    },
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
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(plaintext)
    );
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
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  } catch(e) {
    console.error("Decryption failed:", e);
    return "";
  }
}

/* ===== PERSISTENCE ===== */
function getApiUrl(){return localStorage.getItem('hv_api_url')||''}
function setApiUrl(u){localStorage.setItem('hv_api_url',u);dbPut('config','api_url',u)}
function getSavedUser(){try{return localStorage.getItem('hv_user')||''}catch(e){return''}}
function setSavedUser(u){localStorage.setItem('hv_user',u);dbPut('config','user',u)}
function getSavedPw(){try{return localStorage.getItem('hv_pw')||''}catch(e){return''}}
function setSavedPw(p){localStorage.setItem('hv_pw',p);dbPut('config','pw',p)}
function clearSavedCreds(){try{localStorage.removeItem('hv_user');localStorage.removeItem('hv_pw');dbDelete('config','user');dbDelete('config','pw')}catch(e){}}

/* ===== API ===== */
async function api(action, extra){
  var base=getApiUrl();
  if(!base)throw new Error('API URL not configured');
  var params='?action='+encodeURIComponent(action)+'&user='+encodeURIComponent(username)+'&pw='+encodeURIComponent(password);
  if(extra)for(var k in extra)params+='&'+encodeURIComponent(k)+'='+encodeURIComponent(extra[k]);
  var controller=new AbortController();
  var timeoutId=setTimeout(function(){controller.abort()},10000);
  try{
    var res=await fetch(base+params,{signal:controller.signal});
    clearTimeout(timeoutId);
    if(!res.ok)throw new Error('HTTP '+res.status);
    return await res.json();
  }catch(e){
    clearTimeout(timeoutId);
    if(e.name==='AbortError')throw new Error('API connection timed out. Please check your Web App URL and deployment.');
    throw e;
  }
}

/* ===== TOTP ===== */
function b32d(s){var a='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',t=s.replace(/[\s=-]/g,'').toUpperCase(),b='';for(var i=0;i<t.length;i++){var v=a.indexOf(t[i]);if(v>=0)b+=('00000'+v.toString(2)).slice(-5)}var r=[];for(var i=0;i+8<=b.length;i+=8)r.push(parseInt(b.substring(i,i+8),2));return new Uint8Array(r)}
async function hmac1(k,m){var key=await crypto.subtle.importKey('raw',k,{name:'HMAC',hash:'SHA-1'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,m))}
async function totp(secret){var k=b32d(secret),c=Math.floor(Math.floor(Date.now()/1000)/30),buf=new ArrayBuffer(8);new DataView(buf).setUint32(4,c,false);var h=await hmac1(k,new Uint8Array(buf)),o=h[h.length-1]&0x0f,bin=((h[o]&0x7f)<<24)|((h[o+1]&0xff)<<16)|((h[o+2]&0xff)<<8)|(h[o+3]&0xff),r=(bin%1000000).toString();while(r.length<6)r='0'+r;return r}

/* ===== LOGIN ===== */
document.getElementById('pwInput').addEventListener('keydown',function(e){if(e.key==='Enter')submitPw()});
document.getElementById('userInput').addEventListener('keydown',function(e){if(e.key==='Enter')submitPw()});

function hideSplash(){
  var s = document.getElementById('splashScreen');
  if(s){
    s.style.opacity = 0;
    setTimeout(function(){ s.style.display = 'none'; }, 400);
  }
}

/* ===== PWA INSTALLATION ===== */
var deferredPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  deferredPrompt = e;
  var btnLogin = document.getElementById('btnInstallPwaLogin');
  var divLogin = document.getElementById('pwaDividerLogin');
  if (btnLogin) btnLogin.style.display = 'inline-flex';
  if (divLogin) divLogin.style.display = 'inline-flex';
  var btnSidebar = document.getElementById('btnInstallPwaSidebar');
  if (btnSidebar) btnSidebar.style.display = 'flex';
});

window.addEventListener('appinstalled', function(evt) {
  console.log('App installed successfully');
  hidePwaInstallButtons();
});

function triggerPwaInstall() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(function(choiceResult) {
    if (choiceResult.outcome === 'accepted') {
      console.log('User accepted the PWA install prompt');
    } else {
      console.log('User dismissed the PWA install prompt');
    }
    deferredPrompt = null;
    hidePwaInstallButtons();
  });
}

function hidePwaInstallButtons() {
  var btnLogin = document.getElementById('btnInstallPwaLogin');
  var divLogin = document.getElementById('pwaDividerLogin');
  var btnSidebar = document.getElementById('btnInstallPwaSidebar');
  if (btnLogin) btnLogin.style.display = 'none';
  if (divLogin) divLogin.style.display = 'none';
  if (btnSidebar) btnSidebar.style.display = 'none';
}

(function initLogin(){
  var gPre=document.getElementById('gasCodePre');
  if(gPre)gPre.textContent=gasCode;
  if(tickInterval)clearInterval(tickInterval);
  tickInterval=setInterval(tick,500);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      window.location.reload();
    });
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('./sw.js').then(function(reg) {
        console.log('SW registered');
      }).catch(function(err) {
        console.error('SW registration failed:', err);
      });
    });
  }
  var saved=getApiUrl();
  if(saved){
    document.getElementById('apiUrlInputLogin').value=saved;
    var su=getSavedUser();
    if(su){document.getElementById('userInput').value=su}
    var sp=getSavedPw();
    if(su && sp){username=su;password=sp;doAutoLogin()}
    else{hideSplash()}
  }else{
    hideSplash();
    document.getElementById('loginSetupDetails').open = true;
  }
})();

async function doAutoLogin(){
  try{
    var d=await api('login');
    if(d.success){
      username=(d.username||username).toLowerCase();
      isLoggedIn=true;
      document.querySelectorAll('.private-nav').forEach(function(el){el.style.display='flex'});
      document.getElementById('sidebarUserSection').style.display='flex';
      document.getElementById('btnSidebarLogout').style.display='flex';
      document.getElementById('btnSidebarLogin').style.display='none';
      document.getElementById('screenLogin').style.display='none';
      document.getElementById('screenApp').style.display='flex';
      loadAccounts();
    }else{clearSavedCreds();username='';password=''}
  }catch(e){
    // Network/Connection failure (Offline Mode)
    // Do NOT clear credentials, instead bypass and let loadAccounts load from local cache
    isLoggedIn=true;
    document.querySelectorAll('.private-nav').forEach(function(el){el.style.display='flex'});
    document.getElementById('sidebarUserSection').style.display='flex';
    document.getElementById('btnSidebarLogout').style.display='flex';
    document.getElementById('btnSidebarLogin').style.display='none';
    document.getElementById('screenLogin').style.display='none';
    document.getElementById('screenApp').style.display='flex';
    loadAccounts();
  }
  hideSplash();
}

async function submitPw(){
  var user=document.getElementById('userInput').value.trim();
  var pw=document.getElementById('pwInput').value;
  var inpU=document.getElementById('userInput');
  var inpP=document.getElementById('pwInput');
  var err=document.getElementById('pwError');
  var btn=document.getElementById('pwBtn');
  if(!getApiUrl()){err.textContent='Configure API URL first (click settings below)';err.classList.add('show');return}
  if(!user || !pw){err.textContent='Username and password required';err.classList.add('show');return}
  btn.textContent='Checking...';btn.disabled=true;
  username=user;
  password=pw;
  try{
    var d=await api('login');
    if(d.success){
      username=(d.username||user).toLowerCase();
      isLoggedIn=true;
      document.querySelectorAll('.private-nav').forEach(function(el){el.style.display='flex'});
      document.getElementById('sidebarUserSection').style.display='flex';
      document.getElementById('btnSidebarLogout').style.display='flex';
      document.getElementById('btnSidebarLogin').style.display='none';
      setSavedUser(username);
      setSavedPw(pw);err.classList.remove('show');
      document.getElementById('screenLogin').style.display='none';
      document.getElementById('screenApp').style.display='flex';
      loadAccounts();
    }else{
      inpU.classList.add('error');
      inpP.classList.add('error');err.textContent='Wrong username or password';err.classList.add('show');
      setTimeout(function(){inpU.classList.remove('error');inpP.classList.remove('error')},400);
      username='';password='';
    }
  }catch(e){err.textContent='Connection failed: '+e.message;err.classList.add('show');username='';password=''}
  btn.textContent='Unlock';btn.disabled=false;
  hideSplash();
}

function showPublicView(v) {
  isLoggedIn=false;
  document.querySelectorAll('.private-nav').forEach(function(el){el.style.display='none'});
  document.getElementById('sidebarUserSection').style.display='none';
  document.getElementById('btnSidebarLogout').style.display='none';
  document.getElementById('btnSidebarLogin').style.display='flex';
  document.getElementById('screenLogin').style.display='none';
  document.getElementById('screenApp').style.display='flex';
  switchView(v);
}

function goBackToLogin() {
  document.getElementById('screenApp').style.display='none';
  document.getElementById('screenLogin').style.display='flex';
  switchView('accounts');
}

function saveApiUrlFromLogin(){
  var u=document.getElementById('apiUrlInputLogin').value.trim();
  if(u){setApiUrl(u);showToast('API URL saved!')}
}

/* ===== LOCK ===== */
function lockApp(){
  isLoggedIn=false;
  document.getElementById('screenApp').style.display='none';
  document.getElementById('screenLogin').style.display='flex';
  document.getElementById('userInput').value='';
  document.getElementById('pwInput').value='';
  document.getElementById('pwError').classList.remove('show');
  accounts=[];codes=[];username='';password='';clearSavedCreds();
  document.querySelectorAll('.private-nav').forEach(function(el){el.style.display='flex'});
  document.getElementById('sidebarUserSection').style.display='flex';
  document.getElementById('btnSidebarLogout').style.display='flex';
  document.getElementById('btnSidebarLogin').style.display='none';
  if(tickInterval){clearInterval(tickInterval);tickInterval=null}
  closeSidebar();
}

/* ===== SIDEBAR ===== */
function openSidebar(){document.getElementById('sidebar').classList.add('open');document.getElementById('sidebarOverlay').classList.add('show')}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sidebarOverlay').classList.remove('show')}

/* ===== VIEW SWITCHING ===== */
function switchView(v){
  currentView=v;
  document.querySelectorAll('.view').forEach(function(el){el.classList.remove('active')});
  document.querySelectorAll('.nav-item').forEach(function(el){
    el.classList.remove('active');
    if(el.querySelector('.ms'))el.querySelector('.ms').classList.remove('ms-fill');
    if(el.dataset.view===v){el.classList.add('active');if(el.querySelector('.ms'))el.querySelector('.ms').classList.add('ms-fill')}
  });
  if(v==='accounts')document.getElementById('viewAccounts').classList.add('active');
  else if(v==='favorites')document.getElementById('viewFavorites').classList.add('active');
  else if(v==='live')document.getElementById('viewLive').classList.add('active');
  else if(v==='impexp')document.getElementById('viewImpExp').classList.add('active');
  else if(v==='tutorial')document.getElementById('viewTutorial').classList.add('active');
  else if(v==='settings'){
    document.getElementById('viewSettings').classList.add('active');
    document.getElementById('settingsApiUrl').value=getApiUrl();
  }
  renderView();
  closeSidebar();
}

/* ===== OFFLINE QUEUE & SYNC ===== */
var isOnline=navigator.onLine;
var isSyncing=false;

function setOnline(online){
  isOnline=online;
  var sb=document.getElementById('sidebarStatus');
  var tb=document.getElementById('topbarStatus');
  var bc=online?'status-badge online':'status-badge offline';
  var bt=online?'Connected':'Offline';
  [sb,tb].forEach(function(el){
    if(el){
      el.className=bc;
      el.querySelector('.text').textContent=bt;
    }
  });
}

async function addToOfflineQueue(action,params){
  var id=Date.now();
  await dbPut('queue',id,{id:id,action:action,params:params});
  if('serviceWorker' in navigator && 'SyncManager' in window){
    try{
      var reg=await navigator.serviceWorker.ready;
      await reg.sync.register('sync-hv-vault');
    }catch(e){}
  }
}

async function processOfflineQueue(){
  if(isSyncing||!navigator.onLine)return;
  var q=await dbGetAll('queue');
  if(q.length===0)return;
  isSyncing=true;
  showToast('Syncing offline changes...',false);
  var failedCount=0;
  for(var i=0;i<q.length;i++){
    var item=q[i];
    try{
      var d=await api(item.action,item.params);
      if(!d.success)throw new Error(d.error);
      await dbDelete('queue',item.id);
    }catch(e){
      failedCount++;
    }
  }
  isSyncing=false;
  if(failedCount===0){
    showToast('Sync complete!',false);
    await loadAccounts();
  }else{
    showToast('Some changes failed to sync ('+failedCount+' pending)',true);
  }
}

window.addEventListener('online',function(){setOnline(true);processOfflineQueue()});
window.addEventListener('offline',function(){setOnline(false);showToast('Offline Mode',true)});

async function saveLocalCache() {
  try {
    if (password && username) {
      var encrypted = await encryptData(JSON.stringify(accounts), password, username);
      localStorage.setItem('hv_cached_accounts', encrypted);
    }
  } catch(e) {
    console.error('Failed to save local cache:', e);
  }
}

/* ===== LOAD ACCOUNTS ===== */
async function loadAccounts(){
  var userEl=document.getElementById('sidebarUsername');
  if(userEl)userEl.textContent=username;
  try{
    var d=await api('accounts');
    if(d.success){
      accounts=d.accounts||[];
      await saveLocalCache();
      codes=new Array(accounts.length);
      await refreshAll();
      if(tickInterval)clearInterval(tickInterval);
      tickInterval=setInterval(tick,500);
      setOnline(true);
      processOfflineQueue();
    }else lockApp();
  }catch(e){
    var cached=localStorage.getItem('hv_cached_accounts');
    if(cached){
      var decrypted=await decryptData(cached,password,username);
      if(decrypted){
        accounts=JSON.parse(decrypted);
        codes=new Array(accounts.length);
        await refreshAll();
        if(tickInterval)clearInterval(tickInterval);
        tickInterval=setInterval(tick,500);
        setOnline(false);
        showToast('Offline Mode. Using cached data.',true);
      }else{
        document.getElementById('cardsContainer').innerHTML='<div class="empty-state"><span class="ms">error</span><p>Decryption failed or cache is empty</p></div>';
        setOnline(false);
      }
    }else{
      document.getElementById('cardsContainer').innerHTML='<div class="empty-state"><span class="ms">error</span><p>Failed to load: '+esc(e.message)+'</p></div>';
      setOnline(false);
    }
  }
}

/* ===== SORT ===== */
function toggleSort(mode){
  var btn=document.getElementById('btnSortAZ');
  if(sortMode==='none'){sortMode='az';btn.classList.add('active');btn.querySelector('.sort-label').textContent='A-Z'}
  else if(sortMode==='az'){sortMode='za';btn.querySelector('.sort-label').textContent='Z-A'}
  else{sortMode='none';btn.classList.remove('active');btn.querySelector('.sort-label').textContent='A-Z'}
  renderView();
}

function getSortedAccounts(list){
  var items=list.map(function(a,i){return{a:a,c:codes[accounts.indexOf(a)]||'------',oi:accounts.indexOf(a)};});
  if(sortMode==='az')items.sort(function(a,b){return a.a.label.localeCompare(b.a.label)});
  else if(sortMode==='za')items.sort(function(a,b){return b.a.label.localeCompare(a.a.label)});
  else if(sortMode==='none'){
    items.sort(function(a,b){
      if(a.a.fav && !b.a.fav) return -1;
      if(!a.a.fav && b.a.fav) return 1;
      return a.oi - b.oi;
    });
  }
  return items;
}

/* ===== RENDER ===== */
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}

function renderView(){
  if(currentView==='accounts')renderCards('cardsContainer',accounts,document.getElementById('searchInput').value,true);
  else if(currentView==='favorites'){
    var favs=accounts.filter(function(a){return a.fav});
    renderCards('cardsFavContainer',favs,document.getElementById('searchFav').value,false);
  }
}

function renderCards(containerId,list,query,allowDrag){
  var container=document.getElementById(containerId);
  query=(query||'').toLowerCase();
  if(!list.length){
    var isFav=containerId==='cardsFavContainer';
    if(isFav)container.innerHTML='<div class="empty-state"><span class="ms">star</span><p>No favorites yet. Star an account to see it here.</p></div>';
    else container.innerHTML='<div class="empty-state"><span class="ms">key</span><p>No accounts yet. Add one to get started.</p></div>';
    return;
  }
  var filtered=list.filter(function(a){return !query||a.label.toLowerCase().indexOf(query)!==-1});
  var items=getSortedAccounts(filtered);
  if(!items.length){container.innerHTML='<div class="empty-state"><span class="ms">search_off</span><p>No matching accounts found.</p></div>';return}

  var now=Math.floor(Date.now()/1000),left=30-(now%30),prog=left/30;
  var dashOff=(CIRC*(1-prog)).toFixed(1);
  var ringColor=left<=5?'var(--error)':'var(--primary)';
  var numColor=left<=5?'var(--error)':'var(--on-surface)';
  var canDrag=allowDrag&&sortMode==='none'&&!query;

  var html='<div class="cards-grid">';
  for(var x=0;x<items.length;x++){
    var it=items[x],a=it.a,c=it.c,oi=it.oi;
    var ico=getIcon(a.label);
    var c1=c.substring(0,3),c2=c.substring(3);
    html+='<div class="card'+(a.fav?' fav':'')+'" data-oi="'+oi+'"'+(canDrag?' draggable="true" ondragstart="dStart(event)" ondragover="dOver(event)" ondragenter="dEnter(event)" ondragleave="dLeave(event)" ondrop="dDrop(event)" ondragend="dEnd(event)"':'')+' onclick="copyCode('+oi+')">';
    html+='<div class="card-accent"></div>';
    html+='<div class="card-copied" id="copied'+oi+'">Copied!</div>';
    html+='<div class="card-top"><div class="card-identity">';
    if(canDrag)html+='<div class="drag-handle card-btn" onclick="event.stopPropagation()"><span class="ms">drag_indicator</span></div>';
    html+='<div class="card-icon"><span class="ms" style="color:'+ico.c+'">'+ico.i+'</span></div>';
    html+='<div class="card-info"><div class="card-label">'+esc(a.label)+'</div><div class="card-sub">'+esc(a.secret.substring(0,4)+'****')+'</div></div></div>';
    html+='<div class="card-menu-container"><button class="card-btn" onclick="event.stopPropagation();toggleCardMenu(event,'+oi+')" title="Menu"><span class="ms">more_vert</span></button>';
    html+='<div class="card-dropdown" id="dropdown-'+oi+'">';
    html+='<div class="dropdown-item" onclick="event.stopPropagation();toggleFav('+oi+')"><span class="ms '+(a.fav?'ms-fill':'')+'" style="'+(a.fav?'color:#f59e0b;':'')+'">star</span>'+(a.fav?'Unfavorite':'Favorite')+'</div>';
    html+='<div class="dropdown-item" onclick="event.stopPropagation();openEditModal('+oi+')"><span class="ms">edit</span>Edit</div>';
    html+='<div class="dropdown-item" onclick="event.stopPropagation();exportQR('+oi+')"><span class="ms">qr_code</span>Export QR</div>';
    html+='<div class="dropdown-item" onclick="event.stopPropagation();confirmDelete('+oi+')" style="color:var(--error);"><span class="ms" style="color:var(--error);">delete</span>Delete</div>';
    html+='</div></div></div>';
    html+='<div class="card-bottom"><div class="card-code"><span>'+c1+'</span><span>'+c2+'</span><span class="ms copy-icon">content_copy</span></div>';
    html+='<div class="card-ring"><svg width="48" height="48" viewBox="0 0 44 44"><circle class="rbg" cx="22" cy="22" r="18"/><circle class="rfg" cx="22" cy="22" r="18" stroke="'+ringColor+'" stroke-dasharray="'+CIRC.toFixed(1)+'" stroke-dashoffset="'+dashOff+'"/></svg><div class="rnum" style="color:'+numColor+'">'+left+'</div></div>';
    html+='</div></div>';
  }
  html+='</div>';
  container.innerHTML=html;
}

function toggleCardMenu(event,oi){
  event.stopPropagation();
  document.querySelectorAll('.card').forEach(function(c){
    c.classList.remove('menu-open');
  });
  document.querySelectorAll('.card-dropdown').forEach(function(el){
    if(el.id!=='dropdown-'+oi){el.classList.remove('show');}
  });
  var d=document.getElementById('dropdown-'+oi);
  if(d){
    d.classList.toggle('show');
    if(d.classList.contains('show')){
      d.closest('.card').classList.add('menu-open');
    }
  }
}
document.addEventListener('click',function(){
  document.querySelectorAll('.card-dropdown').forEach(function(el){el.classList.remove('show');});
  document.querySelectorAll('.card').forEach(function(c){c.classList.remove('menu-open');});
});

/* ===== COPY ===== */
function copyCode(oi){
  if(codes[oi])navigator.clipboard.writeText(codes[oi]).then(function(){showToast('Copied '+accounts[oi].label+' code')});
  var el=document.getElementById('copied'+oi);
  if(el){el.classList.add('show');setTimeout(function(){el.classList.remove('show')},1500)}
}

/* ===== FAVORITE ===== */
async function toggleFav(oi){
  var a=accounts[oi];
  var oldFav=a.fav;
  a.fav=!oldFav;
  renderView();
  await saveLocalCache();
  if(!isOnline){
    addToOfflineQueue('favorite',{row:a.row});
    showToast(a.fav?a.label+' favorited (offline)':a.label+' unfavorited (offline)',false);
    return;
  }
  showToast(a.fav?a.label+' added to favorites':a.label+' removed from favorites');
  try{
    var d=await api('favorite',{row:a.row});
    if(!d.success)throw new Error(d.error);
    a.fav=d.fav;
    renderView();
    await saveLocalCache();
  }catch(e){
    if(!isOnline){
      addToOfflineQueue('favorite',{row:a.row});
      showToast('Offline Mode. Favorited locally.',true);
    }else{
      a.fav=oldFav;
      renderView();
      showToast('Failed to save favorite: '+e.message,true);
    }
  }
}

/* ===== ADD ACCOUNT ===== */
async function doAddAccount(){
  var label=document.getElementById('addLabel').value.trim();
  var secret=document.getElementById('addSecret').value.trim().replace(/\s/g,'').toUpperCase();
  if(!label||!secret){showToast('Fill in both fields',true);return}
  closeModal('modalAdd');
  document.getElementById('addLabel').value='';
  document.getElementById('addSecret').value='';
  
  var tempRow=accounts.length>0?Math.max.apply(Math,accounts.map(function(o){return o.row}))+1:3;
  var newAcc={label:label,secret:secret,fav:false,row:tempRow};
  accounts.push(newAcc);
  codes.push('------');
  renderView();
  refreshAll();
  await saveLocalCache();

  if(!isOnline){
    addToOfflineQueue('add',{label:label,secret:secret});
    showToast(label+' added locally (offline)');
    return;
  }
  try{
    var d=await api('add',{label:label,secret:secret});
    if(d.success){
      showToast(label+' added successfully');
      await loadAccounts();
    }else throw new Error(d.error);
  }catch(e){
    if(!isOnline){
      addToOfflineQueue('add',{label:label,secret:secret});
      showToast('Offline Mode. Account queued.',true);
    }else{
      accounts.pop();
      codes.pop();
      renderView();
      showToast('Failed to add: '+e.message,true);
    }
  }
}

/* ===== EDIT ACCOUNT ===== */
var editTargetOi=null;
function openEditModal(oi){
  editTargetOi=oi;
  var a=accounts[oi];
  document.getElementById('editLabel').value=a.label;
  document.getElementById('editSecret').value=a.secret;
  document.getElementById('editSecret').type='password';
  document.getElementById('eyeIcon').textContent='visibility';
  openModal('modalEdit');
}
function toggleViewSecret(){
  var inp=document.getElementById('editSecret');
  var eye=document.getElementById('eyeIcon');
  if(inp.type==='password'){inp.type='text';eye.textContent='visibility_off'}
  else{inp.type='password';eye.textContent='visibility'}
}
async function doEditAccount(){
  if(editTargetOi===null)return;
  var label=document.getElementById('editLabel').value.trim();
  var secret=document.getElementById('editSecret').value.trim().replace(/\s/g,'').toUpperCase();
  if(!label||!secret){showToast('Fields cannot be empty',true);return}
  var a=accounts[editTargetOi];
  var oldLabel=a.label;
  var oldSecret=a.secret;
  a.label=label;
  a.secret=secret;
  closeModal('modalEdit');
  renderView();
  refreshAll();
  await saveLocalCache();
  showToast('Account updated');
  if(!isOnline){
    addToOfflineQueue('edit',{row:a.row,label:label,secret:secret});
    showToast('Changes saved locally (offline)');
    return;
  }
  try{
    var d=await api('edit',{row:a.row,label:label,secret:secret});
    if(!d.success)throw new Error(d.error);
    await loadAccounts();
  }catch(e){
    if(!isOnline){
      addToOfflineQueue('edit',{row:a.row,label:label,secret:secret});
      showToast('Offline Mode. Edit queued.',true);
    }else{
      a.label=oldLabel;
      a.secret=oldSecret;
      renderView();
      showToast('Failed to save changes: '+e.message,true);
    }
  }
}

/* ===== EXPORT QR ===== */
function exportQR(oi){
  var a=accounts[oi];
  var dateStr=new Date().toISOString().split('T')[0];
  qrDownloadFilename='hi-vault_export_'+a.label.replace(/[^a-z0-9_-]/gi,'_')+'_'+dateStr+'.png';
  document.getElementById('qrSecretText').value=a.secret;
  document.getElementById('qrDesc').textContent='Scan this code with an authenticator app.';
  var uri='otpauth://totp/Hi-Vault:'+encodeURIComponent(a.label)+'?secret='+a.secret+'&issuer=Hi-Vault';
  var qr=new QRious({
    element:document.getElementById('qrCanvas'),
    value:uri,
    size:200,
    level:'M'
  });
  openModal('modalQR');
}

function downloadQR(){
  var canvas=document.getElementById('qrCanvas');
  var link=document.createElement('a');
  link.href=canvas.toDataURL('image/png');
  link.download=qrDownloadFilename||'qr-code.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('QR Code downloaded successfully');
}

/* ===== EXPORT EXCEL (CSV) ===== */
function downloadCSV(){
  var csv='Label,Secret Key\n';
  accounts.forEach(function(a){
    csv+='"'+a.label.replace(/"/g,'""')+'","'+a.secret.replace(/"/g,'""')+'"\n';
  });
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  var link=document.createElement("a");
  link.href=URL.createObjectURL(blob);
  link.setAttribute("download","hi-vault-backup.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('CSV downloaded successfully');
}

/* ===== EXPORT ALL TO GA QR ===== */
function writeVarint(value) {
  var bytes = [];
  while (value > 127) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value & 0x7f);
  return bytes;
}

function writeLengthDelimited(fieldNum, contentBytes) {
  var tag = (fieldNum << 3) | 2;
  var tagBytes = writeVarint(tag);
  var lenBytes = writeVarint(contentBytes.length);
  return tagBytes.concat(lenBytes).concat(Array.from(contentBytes));
}

function writeStringField(fieldNum, str) {
  var encoder = new TextEncoder();
  var bytes = encoder.encode(str);
  return writeLengthDelimited(fieldNum, bytes);
}

function writeVarintField(fieldNum, value) {
  var tag = (fieldNum << 3) | 0;
  var tagBytes = writeVarint(tag);
  var valBytes = writeVarint(value);
  return tagBytes.concat(valBytes);
}

function base64EncodeUrlSafe(bytes) {
  var binary = '';
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  var base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function exportAllToQR(){
  if(accounts.length === 0){
    showToast('No accounts to export', true);
    return;
  }
  try {
    var dateStr=new Date().toISOString().split('T')[0];
    qrDownloadFilename=username+'_'+dateStr+'.png';
    var payloadBytes = [];
    accounts.forEach(function(a) {
      var secretBytes = b32d(a.secret);
      var secretField = writeLengthDelimited(1, secretBytes);
      var nameField = writeStringField(2, a.label);
      var issuerField = writeStringField(3, "Hi-Vault");
      var algoField = writeVarintField(4, 1); // SHA1
      var digitsField = writeVarintField(5, 1); // 6 digits
      var typeField = writeVarintField(6, 2); // TOTP
      
      var otpParamsBytes = secretField.concat(nameField).concat(issuerField).concat(algoField).concat(digitsField).concat(typeField);
      var otpParametersField = writeLengthDelimited(1, otpParamsBytes);
      payloadBytes = payloadBytes.concat(otpParametersField);
    });
    
    var base64 = base64EncodeUrlSafe(new Uint8Array(payloadBytes));
    var migrationUri = 'otpauth-migration://offline?data=' + base64;
    
    document.getElementById('qrSecretText').value = 'otpauth-migration://offline';
    document.getElementById('qrDesc').textContent = 'Scan this QR code in Google Authenticator on your phone to import all ' + accounts.length + ' accounts.';
    
    var qr = new QRious({
      element: document.getElementById('qrCanvas'),
      value: migrationUri,
      size: 250,
      level: 'M'
    });
    openModal('modalQR');
  } catch(e) {
    showToast('Export failed: ' + e.message, true);
  }
}

/* ===== SETTINGS QR SCANNER ===== */
function startSettingsQRScanner(){startFsScanner(decodeMigrationQR)}
function stopSettingsQRScanner(){stopFsScanner()}

function decodeMigrationQR(decodedText) {
  if (decodedText.startsWith('otpauth-migration://offline?data=')) {
    var url = new URL(decodedText);
    var dataParam = url.searchParams.get('data');
    if (dataParam) {
      var bytes = decodeUrlSafeBase64(dataParam);
      var imported = parseProtobuf(bytes);
      if (imported && imported.length > 0) {
        doBulkImport(imported);
      } else {
        showToast('No accounts found in QR payload', true);
      }
    }
  } else {
    try {
      if (decodedText.startsWith('otpauth://')) {
        var url = new URL(decodedText);
        var label = decodeURIComponent(url.pathname).replace(/^\/\/totp\//,'').replace(/^\/totp\//,'');
        if(label.indexOf(':')!==-1)label=label.substring(label.indexOf(':')+1);
        var secret = url.searchParams.get('secret');
        var issuer = url.searchParams.get('issuer');
        if(issuer && label.indexOf(issuer)===-1) label = issuer + ' (' + label + ')';
        if (label && secret) {
          doBulkImport([{ label: label, secret: secret.toUpperCase() }]);
        } else {
          throw new Error('Missing info');
        }
      } else {
        throw new Error('Invalid URI');
      }
    } catch(err) {
      showToast('Not a valid Authenticator QR code', true);
    }
  }
}

/* ===== BULK IMPORT ===== */
async function doBulkImport(items) {
  closeModal('modalAdd');
  var tempRow=accounts.length>0?Math.max.apply(Math,accounts.map(function(o){return o.row}))+1:3;
  items.forEach(function(item,idx){
    accounts.push({label:item.label,secret:item.secret,fav:false,row:tempRow+idx});
    codes.push('------');
  });
  renderView();
  refreshAll();
  await saveLocalCache();
  if(!isOnline){
    addToOfflineQueue('import',{accounts:JSON.stringify(items)});
    showToast('Imported '+items.length+' accounts locally (offline)',false);
    return;
  }
  showToast('Importing ' + items.length + ' accounts...');
  try {
    var d = await api('import', { accounts: JSON.stringify(items) });
    if (d.success) {
      showToast('Successfully imported ' + items.length + ' accounts!');
      await loadAccounts();
    } else {
      throw new Error(d.error);
    }
  } catch(err) {
    if(!isOnline){
      addToOfflineQueue('import',{accounts:JSON.stringify(items)});
      showToast('Offline Mode. Import queued.',true);
    }else{
      accounts.splice(accounts.length-items.length,items.length);
      codes.splice(codes.length-items.length,items.length);
      renderView();
      showToast('Import failed: ' + err.message, true);
    }
  }
}

function importCSV(e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(evt) {
    var text = evt.target.result;
    try {
      var lines = text.split(/\r?\n/);
      var imported = [];
      var startIndex = 0;
      if (lines.length > 0 && (lines[0].toLowerCase().indexOf('secret') !== -1 || lines[0].toLowerCase().indexOf('label') !== -1)) {
        startIndex = 1;
      }
      for (var i = startIndex; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;
        var parts = line.split(',');
        if (parts && parts.length >= 2) {
          var label = parts[0].replace(/^"|"$/g, '').trim();
          var secret = parts[1].replace(/^"|"$/g, '').trim().replace(/\s/g, '').toUpperCase();
          if (label && secret) {
            imported.push({ label: label, secret: secret });
          }
        }
      }
      if (imported.length === 0) {
        showToast('No valid accounts found in CSV', true);
      } else {
        doBulkImport(imported);
      }
    } catch(err) {
      showToast('Error parsing CSV: ' + err.message, true);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ===== GOOGLE AUTHENTICATOR QR IMPORT ===== */
function decodeUrlSafeBase64(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) { str += '='; }
  var binary = atob(str);
  var len = binary.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base32Encode(bytes) {
  var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  var bits = 0;
  var value = 0;
  var output = '';
  for (var i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

function parseProtobuf(buffer) {
  var pos = 0;
  var otps = [];
  function readVarint() {
    var value = 0;
    var shift = 0;
    while (true) {
      var b = buffer[pos++];
      value |= (b & 0x7f) << shift;
      if (!(b & 0x80)) break;
      shift += 7;
    }
    return value;
  }
  function readBytes(len) {
    var bytes = buffer.subarray(pos, pos + len);
    pos += len;
    return bytes;
  }
  while (pos < buffer.length) {
    var tag = readVarint();
    var wireType = tag & 0x07;
    var fieldNum = tag >> 3;
    if (fieldNum === 1 && wireType === 2) {
      var len = readVarint();
      var subBuffer = readBytes(len);
      var otp = parseOtpParams(subBuffer);
      if (otp.secret) otps.push(otp);
    } else {
      if (wireType === 0) readVarint();
      else if (wireType === 1) pos += 8;
      else if (wireType === 2) pos += readVarint();
      else if (wireType === 5) pos += 4;
    }
  }
  return otps;
}

function parseOtpParams(buffer) {
  var pos = 0;
  var otp = { secret: '', label: '' };
  var name = '', issuer = '';
  function readVarint() {
    var value = 0;
    var shift = 0;
    while (true) {
      var b = buffer[pos++];
      value |= (b & 0x7f) << shift;
      if (!(b & 0x80)) break;
      shift += 7;
    }
    return value;
  }
  function readBytes(len) {
    var bytes = buffer.subarray(pos, pos + len);
    pos += len;
    return bytes;
  }
  function readString(len) {
    var bytes = readBytes(len);
    return new TextDecoder('utf-8').decode(bytes);
  }
  while (pos < buffer.length) {
    var tag = readVarint();
    var wireType = tag & 0x07;
    var fieldNum = tag >> 3;
    if (fieldNum === 1 && wireType === 2) {
      var len = readVarint();
      otp.secret = base32Encode(readBytes(len));
    } else if (fieldNum === 2 && wireType === 2) {
      name = readString(readVarint());
    } else if (fieldNum === 3 && wireType === 2) {
      issuer = readString(readVarint());
    } else {
      if (wireType === 0) readVarint();
      else if (wireType === 1) pos += 8;
      else if (wireType === 2) pos += readVarint();
      else if (wireType === 5) pos += 4;
    }
  }
  if (issuer && name.indexOf(issuer) === -1) {
    otp.label = issuer + ' (' + name + ')';
  } else {
    otp.label = name || 'Imported Account';
  }
  return otp;
}

function importGoogleAuthQR(e) {
  var file = e.target.files[0];
  if (!file) return;
  var html5QrCode = new Html5Qrcode("qrReader");
  showToast('Reading Migration QR...');
  html5QrCode.scanFile(file, true)
    .then(decodedText => {
      decodeMigrationQR(decodedText);
    })
    .catch(err => {
      showToast('Failed to parse QR: ' + err, true);
    });
  e.target.value = '';
}

/* ===== FULLSCREEN QR SCANNER ===== */
var fsScanner=null,fsScanCallback=null;
function startFsScanner(callback){
  fsScanCallback=callback;
  document.getElementById('fsScanner').classList.add('show');
  document.getElementById('fsErrMsg').textContent='';
  fsScanner=new Html5Qrcode("fsReader");
  fsScanner.start(
    {facingMode:"environment"},
    {fps:15,qrbox:{width:240,height:240}},
    function(decodedText){
      stopFsScanner();
      if(fsScanCallback)fsScanCallback(decodedText);
    },
    function(error){}
  ).catch(function(err){
    document.getElementById('fsErrMsg').textContent='Camera error: check permissions';
    showToast('Camera error: '+err,true);
  });
}
function stopFsScanner(){
  if(fsScanner){
    fsScanner.stop().then(function(){
      document.getElementById('fsScanner').classList.remove('show');
      fsScanner=null;
    }).catch(function(){
      document.getElementById('fsScanner').classList.remove('show');
      fsScanner=null;
    });
  }else{
    document.getElementById('fsScanner').classList.remove('show');
  }
  fsScanCallback=null;
}
function startQRScanner(){startFsScanner(parseTOTPUri)}
function stopQRScanner(){stopFsScanner()}
function uploadQR(e){
  var file=e.target.files[0];
  if(!file)return;
  var scanner=new Html5Qrcode("fsReader");
  showToast('Reading QR Code...');
  scanner.scanFile(file,true).then(function(decodedText){
    parseTOTPUri(decodedText);
    showToast('QR Code parsed');
  }).catch(function(err){showToast('Failed to read QR: '+err,true)});
  e.target.value='';
}
function parseTOTPUri(uri){
  try{
    if(!uri.startsWith('otpauth://')){
      var clean=uri.trim().replace(/\s/g,'').toUpperCase();
      if(/^[A-Z2-7]+=*$/.test(clean)){
        document.getElementById('addSecret').value=clean;
        showToast('Secret key found!');
        return;
      }
      throw new Error('Invalid code content');
    }
    var url=new URL(uri);
    var label=decodeURIComponent(url.pathname).replace(/^\/\/totp\//,'').replace(/^\/totp\//,'');
    if(label.indexOf(':')!==-1)label=label.substring(label.indexOf(':')+1);
    var secret=url.searchParams.get('secret');
    var issuer=url.searchParams.get('issuer');
    if(issuer&&label.indexOf(issuer)===-1)label=issuer+' ('+label+')';
    if(label)document.getElementById('addLabel').value=label;
    if(secret)document.getElementById('addSecret').value=secret.toUpperCase();
  }catch(err){showToast('QR error: '+err.message,true)}
}

/* ===== DELETE ACCOUNT ===== */
function confirmDelete(oi){
  deleteTarget=oi;
  document.getElementById('deleteLabel').textContent=accounts[oi].label;
  openModal('modalDelete');
}
async function doDeleteAccount(){
  if(deleteTarget===null)return;
  var a=accounts[deleteTarget];
  var removedItem=accounts.splice(deleteTarget,1)[0];
  var removedCode=codes.splice(deleteTarget,1)[0];
  closeModal('modalDelete');
  renderView();
  showToast(a.label+' deleted');
  await saveLocalCache();
  var oldTarget=deleteTarget;
  deleteTarget=null;
  if(!isOnline){
    addToOfflineQueue('delete',{row:a.row});
    showToast(a.label+' deleted locally (offline)',false);
    return;
  }
  try{
    var d=await api('delete',{row:a.row});
    if(!d.success)throw new Error(d.error);
    await loadAccounts();
  }catch(e){
    if(!isOnline){
      addToOfflineQueue('delete',{row:a.row});
      showToast('Offline Mode. Deletion queued.',true);
    }else{
      accounts.splice(oldTarget,0,removedItem);
      codes.splice(oldTarget,0,removedCode);
      renderView();
      showToast('Delete failed: '+e.message,true);
    }
  }
}

/* ===== DRAG & DROP REORDER ===== */
function dStart(e){
  var card=e.target.closest('.card');
  dragSrcIndex=parseInt(card.dataset.oi);
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',dragSrcIndex);
}
function dOver(e){e.preventDefault();e.dataTransfer.dropEffect='move'}
function dEnter(e){e.preventDefault();var card=e.target.closest('.card');if(card)card.classList.add('drag-over')}
function dLeave(e){var card=e.target.closest('.card');if(card)card.classList.remove('drag-over')}
function dDrop(e){
  e.preventDefault();
  var card=e.target.closest('.card');
  if(!card)return;
  card.classList.remove('drag-over');
  var targetIndex=parseInt(card.dataset.oi);
  if(dragSrcIndex===targetIndex||dragSrcIndex===null)return;
  doReorder(dragSrcIndex,targetIndex);
}
function dEnd(e){
  document.querySelectorAll('.card').forEach(function(c){c.classList.remove('dragging','drag-over')});
  dragSrcIndex=null;
}

/* Touch drag support for mobile */
var touchDragEl=null,touchDragOi=null,touchClone=null,touchStartX=0,touchStartY=0,touchOffsetX=0,touchOffsetY=0;
document.addEventListener('touchstart',function(e){
  var handle=e.target.closest('.drag-handle');
  if(!handle)return;
  var card=handle.closest('.card');
  if(!card)return;
  e.preventDefault();
  touchDragEl=card;
  touchDragOi=parseInt(card.dataset.oi);
  touchStartX=e.touches[0].clientX;
  touchStartY=e.touches[0].clientY;
  // Create visual clone
  touchClone=card.cloneNode(true);
  touchClone.style.position='fixed';
  touchClone.style.width=card.offsetWidth+'px';
  touchClone.style.opacity='0.8';
  touchClone.style.zIndex='999';
  touchClone.style.pointerEvents='none';
  touchClone.style.transform='rotate(2deg)';
  var rect=card.getBoundingClientRect();
  touchOffsetX=touchStartX-rect.left;
  touchOffsetY=touchStartY-rect.top;
  touchClone.style.left=rect.left+'px';
  touchClone.style.top=rect.top+'px';
  document.body.appendChild(touchClone);
  card.classList.add('dragging');
},{passive:false});

document.addEventListener('touchmove',function(e){
  if(!touchClone)return;
  e.preventDefault();
  var touch=e.touches[0];
  touchClone.style.left=(touch.clientX-touchOffsetX)+'px';
  touchClone.style.top=(touch.clientY-touchOffsetY)+'px';
  // Highlight target
  var el=document.elementFromPoint(touch.clientX,touch.clientY);
  document.querySelectorAll('.card').forEach(function(c){c.classList.remove('drag-over')});
  if(el){var tc=el.closest('.card');if(tc&&tc!==touchDragEl)tc.classList.add('drag-over')}
},{passive:false});

document.addEventListener('touchend',function(e){
  if(!touchClone)return;
  var touch=e.changedTouches[0];
  var el=document.elementFromPoint(touch.clientX,touch.clientY);
  if(el){var tc=el.closest('.card');if(tc&&tc!==touchDragEl){var targetOi=parseInt(tc.dataset.oi);if(touchDragOi!==null&&targetOi!==touchDragOi)doReorder(touchDragOi,targetOi)}}
  document.querySelectorAll('.card').forEach(function(c){c.classList.remove('dragging','drag-over')});
  if(touchClone&&touchClone.parentNode)touchClone.parentNode.removeChild(touchClone);
  touchClone=null;touchDragEl=null;touchDragOi=null;
});

async function doReorder(fromOi,toOi){
  var fromIdx=accounts.findIndex(function(a,i){return i===fromOi});
  var toIdx=accounts.findIndex(function(a,i){return i===toOi});
  if(fromIdx===-1||toIdx===-1)return;
  
  var item=accounts.splice(fromIdx,1)[0];
  accounts.splice(toIdx,0,item);
  var code=codes.splice(fromIdx,1)[0];
  codes.splice(toIdx,0,code);
  renderView();
  showToast('Order updated');
  await saveLocalCache();
  
  var rows=accounts.map(function(a){return a.row});
  if(!isOnline){
    addToOfflineQueue('reorder',{rows:JSON.stringify(rows)});
    showToast('Order saved locally (offline)',false);
    return;
  }
  try{
    var d=await api('reorder',{rows:JSON.stringify(rows)});
    if(!d.success)throw new Error(d.error);
    await loadAccounts();
  }catch(e){
    if(!isOnline){
      addToOfflineQueue('reorder',{rows:JSON.stringify(rows)});
      showToast('Offline Mode. Reorder queued.',true);
    }else{
      showToast('Sync failed: '+e.message,true);
    }
  }
}

/* ===== MODALS ===== */
function openModal(id){document.getElementById(id).classList.add('show')}
function closeModal(id){
  document.getElementById(id).classList.remove('show');
  if(id==='modalAdd') stopQRScanner();
}

/* ===== SETTINGS ===== */
function saveSettingsApi(){
  var u=document.getElementById('settingsApiUrl').value.trim();
  if(u){
    setApiUrl(u);
    clearSavedCreds();
    username='';
    password='';
    showToast('URL updated. Logging out...');
    setTimeout(function(){
      document.getElementById('screenApp').style.display='none';
      document.getElementById('screenLogin').style.display='flex';
      document.getElementById('userInput').value='';
      document.getElementById('pwInput').value='';
      document.getElementById('pwError').classList.remove('show');
      document.getElementById('apiUrlInputLogin').value=u;
      switchView('accounts');
    }, 1500);
  }
}

/* ===== TOAST ===== */
function showToast(msg,isError){
  var t=document.getElementById('toast');
  document.getElementById('toastText').textContent=msg;
  document.getElementById('toastIcon').textContent=isError?'error':'check_circle';
  t.className='toast'+(isError?' error':'')+' show';
  clearTimeout(t._tid);
  t._tid=setTimeout(function(){t.classList.remove('show')},2200);
}

/* ===== LIVE 2FA ===== */
var liveDecodedLabel='';

async function updateLiveTOTP() {
  var input = document.getElementById('liveSecretInput');
  if (!input) return;
  var val = input.value.trim();
  var codeEl = document.getElementById('liveCode');
  var maskEl = document.getElementById('liveSecretMasked');
  var card = document.getElementById('livePreviewCard');
  var btnSave = document.getElementById('btnLiveSaveCard');
  if (!val) {
    codeEl.innerHTML = '<span>---</span><span>---</span><span class="ms copy-icon">content_copy</span>';
    maskEl.textContent = 'No key entered';
    card.style.borderTopColor = '';
    if(btnSave)btnSave.style.display='none';
    liveDecodedLabel='';
    return;
  }
  var secret = val.replace(/\s/g, '').toUpperCase();
  try {
    var bytes = b32d(secret);
    if (bytes.length === 0) throw new Error();
    var c = await totp(secret);
    codeEl.innerHTML = '<span>' + c.substring(0,3) + '</span><span>' + c.substring(3) + '</span><span class="ms copy-icon">content_copy</span>';
    maskEl.textContent = secret.substring(0,4) + '****';
    card.style.borderTopColor = '';
    if(btnSave)btnSave.style.display=isLoggedIn?'inline-block':'none';
  } catch(e) {
    codeEl.innerHTML = '<span>INV</span><span>ALD</span><span class="ms copy-icon">content_copy</span>';
    maskEl.textContent = 'Invalid Base32 secret';
    card.style.borderTopColor = 'var(--error)';
    if(btnSave)btnSave.style.display='none';
  }
}

async function copyLiveCode() {
  var input = document.getElementById('liveSecretInput');
  if (!input || !input.value.trim()) return;
  var secret = input.value.trim().replace(/\s/g, '').toUpperCase();
  try {
    var bytes = b32d(secret);
    if (bytes.length === 0) throw new Error();
    var c = await totp(secret);
    navigator.clipboard.writeText(c).then(function() {
      showToast('Live code copied!');
    });
    var el = document.getElementById('copiedLive');
    if (el) {
      el.classList.add('show');
      setTimeout(function() { el.classList.remove('show') }, 1500);
    }
  } catch(e) {
    showToast('Invalid key, cannot copy', true);
  }
}

function saveLiveToMyAccounts(){
  var input=document.getElementById('liveSecretInput');
  if(!input||!input.value.trim())return;
  var secret=input.value.trim().replace(/\s/g,'').toUpperCase();
  document.getElementById('addLabel').value=liveDecodedLabel||'Live Decoded';
  document.getElementById('addSecret').value=secret;
  switchView('accounts');
  openModal('modalAdd');
}

function startLiveQRScanner(){startFsScanner(parseLiveQR)}
function stopLiveQRScanner(){stopFsScanner()}
function uploadLiveQR(e){
  var file=e.target.files[0];
  if(!file)return;
  var scanner=new Html5Qrcode("fsReader");
  showToast('Reading QR Code...');
  scanner.scanFile(file,true).then(function(decodedText){
    parseLiveQR(decodedText);
    showToast('QR Code parsed');
  }).catch(function(err){showToast('Failed to read QR: '+err,true)});
  e.target.value='';
}
function parseLiveQR(uri){
  try{
    if(!uri.startsWith('otpauth://')){
      var clean=uri.trim().replace(/\s/g,'').toUpperCase();
      if(/^[A-Z2-7]+=*$/.test(clean)){
        document.getElementById('liveSecretInput').value=clean;
        liveDecodedLabel='';
        updateLiveTOTP();
        showToast('Secret key loaded!');
        return;
      }
      throw new Error('Invalid code content');
    }
    var url=new URL(uri);
    var secret=url.searchParams.get('secret');
    var label=decodeURIComponent(url.pathname).replace(/^\/\/totp\//,'').replace(/^\/totp\//,'');
    if(label.indexOf(':')!==-1)label=label.substring(label.indexOf(':')+1);
    var issuer=url.searchParams.get('issuer');
    if(secret){
      document.getElementById('liveSecretInput').value=secret.toUpperCase();
      liveDecodedLabel=issuer?issuer+' ('+label+')':label;
      updateLiveTOTP();
      showToast('Account details loaded!');
    }
  }catch(err){showToast('QR error: '+err.message,true)}
}

/* ===== REFRESH & TICK ===== */
async function refreshAll(){
  for(var i=0;i<accounts.length;i++){try{codes[i]=await totp(accounts[i].secret)}catch(e){codes[i]='ERROR'}}
  renderView();
  var ts=new Date().toLocaleTimeString();
  document.getElementById('timerLabel').textContent='Updated '+ts;
  var lf=document.getElementById('timerLabelFav');if(lf)lf.textContent='Updated '+ts;
}

var lastLeft=-1;
function tick(){
  var now=Math.floor(Date.now()/1000),left=30-(now%30),prog=left/30;
  var off=(CIRC*(1-prog)).toFixed(1);
  var urg=left<=5;

  // Global rings
  ['timerNum','timerNumFav'].forEach(function(id){var e=document.getElementById(id);if(e)e.textContent=left});
  ['timerArc','timerArcFav'].forEach(function(id){var e=document.getElementById(id);if(e)e.setAttribute('stroke-dashoffset',off)});
  ['timerRing','timerRingFav'].forEach(function(id){var e=document.getElementById(id);if(e){if(urg)e.classList.add('urgent');else e.classList.remove('urgent')}});

  // Card rings
  document.querySelectorAll('.card-ring').forEach(function(cr){
    var fg=cr.querySelector('.rfg'),nm=cr.querySelector('.rnum');
    if(fg){fg.setAttribute('stroke-dashoffset',off);fg.setAttribute('stroke',urg?'var(--error)':'var(--primary)')}
    if(nm){nm.textContent=left;nm.style.color=urg?'var(--error)':'var(--on-surface)'}
  });

  // Live Ring
  var liveArc = document.getElementById('liveArc');
  var liveNum = document.getElementById('liveNum');
  var liveRing = document.getElementById('liveRing');
  if (liveArc) {
    liveArc.setAttribute('stroke-dashoffset', off);
    liveArc.setAttribute('stroke', urg ? 'var(--error)' : 'var(--primary)');
  }
  if (liveNum) {
    liveNum.textContent = left;
    liveNum.style.color = urg ? 'var(--error)' : 'var(--on-surface)';
  }
  if (liveRing) {
    if (urg) liveRing.classList.add('urgent');
    else liveRing.classList.remove('urgent');
  }

  if (currentView === 'live') updateLiveTOTP();

  if(left===30&&lastLeft!==30)refreshAll();
  lastLeft=left;
}
