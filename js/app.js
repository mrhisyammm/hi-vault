/* ===== STATE ===== */
var accounts=[], codes=[], username='', password='', currentView='accounts';
var sortMode='none'; // none | az | za
var sortModeFav='none';
var deleteTarget=null;
var CIRC=2*Math.PI*18;
var tickInterval=null;
var dragSrcIndex=null;
var qrDownloadFilename='';
var isLoggedIn=false;
var openedFromLive=false;

/* Offline memory state to prevent disappearing items during sync */
var offlineDeletedRows = [];
var offlineFavToggles = {};
var offlineEdits = {};
var offlineReorderRows = null;

/* ===== ICON MAP ===== */
var IM={'google':{i:'mail',c:'#4285F4'},'gmail':{i:'mail',c:'#EA4335'},'github':{i:'code',c:'#24292e'},'aws':{i:'cloud',c:'#ff9900'},'amazon':{i:'shopping_cart',c:'#ff9900'},'slack':{i:'forum',c:'#4A154B'},'discord':{i:'headset_mic',c:'#5865F2'},'twitter':{i:'alternate_email',c:'#1DA1F2'},'x.com':{i:'alternate_email',c:'#000'},'facebook':{i:'thumb_up',c:'#1877F2'},'meta':{i:'thumb_up',c:'#1877F2'},'microsoft':{i:'window',c:'#00A4EF'},'azure':{i:'cloud_queue',c:'#0078D4'},'apple':{i:'phone_iphone',c:'#555'},'dropbox':{i:'cloud_upload',c:'#0061FF'},'binance':{i:'currency_bitcoin',c:'#F0B90B'},'coinbase':{i:'currency_exchange',c:'#0052FF'},'steam':{i:'sports_esports',c:'#1b2838'},'telegram':{i:'send',c:'#26A5E4'},'whatsapp':{i:'chat',c:'#25D366'},'instagram':{i:'photo_camera',c:'#E4405F'},'linkedin':{i:'work',c:'#0A66C2'},'cloudflare':{i:'security',c:'#F38020'},'digitalocean':{i:'water_drop',c:'#0080FF'},'digital ocean':{i:'water_drop',c:'#0080FF'},'vercel':{i:'deployed_code',c:'#000'},'netlify':{i:'web',c:'#00C7B7'},'stripe':{i:'payments',c:'#635BFF'},'paypal':{i:'account_balance_wallet',c:'#00457C'},'reddit':{i:'forum',c:'#FF4500'},'wordpress':{i:'edit_note',c:'#21759B'},'shopify':{i:'storefront',c:'#7AB55C'},'figma':{i:'draw',c:'#F24E1E'},'notion':{i:'description',c:'#000'},'bitwarden':{i:'key',c:'#175DDC'},'lastpass':{i:'password',c:'#D32D27'},'1password':{i:'lock',c:'#0572EC'},'tiktok':{i:'music_note',c:'#000'},'youtube':{i:'play_circle',c:'#FF0000'},'twitch':{i:'live_tv',c:'#9146FF'},'epic':{i:'sports_esports',c:'#000'},'riot':{i:'sports_esports',c:'#D32936'},'proton':{i:'mail',c:'#6D4AFF'},'okta':{i:'verified_user',c:'#007DC1'},'jira':{i:'bug_report',c:'#0052CC'},'atlassian':{i:'dashboard',c:'#0052CC'},'heroku':{i:'cloud',c:'#430098'}};
function getIcon(label){var l=label.toLowerCase();for(var k in IM)if(l.indexOf(k)!==-1)return IM[k];return{i:'shield_person',c:'var(--primary)'}}

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
  else if(v==='tutorial'){
    document.getElementById('viewTutorial').classList.add('active');
    var lang=getTutorialLangPreference();
    var view=document.getElementById('viewTutorial');
    if(view)view.setAttribute('data-lang',lang);
    var sel=document.getElementById('tutorialLang');
    if(sel)sel.value=lang;
  }
  else if(v==='settings'){
    document.getElementById('viewSettings').classList.add('active');
    document.getElementById('settingsApiUrl').value=getApiUrl();
    var sel=document.getElementById('settingsTheme');
    if(sel)sel.value=getThemePreference();
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
  isSyncing=true;
  try {
    var q=await dbGetAll('queue');
    if(q.length===0){
      isSyncing=false;
      return;
    }
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
  } catch(err) {
    isSyncing=false;
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

/* ===== MODALS ===== */
function openModal(id){document.getElementById(id).classList.add('show')}
function closeModal(id){
  document.getElementById(id).classList.remove('show');
  if(id==='modalAdd') {
    stopQRScanner();
    document.getElementById('addLabel').value='';
    document.getElementById('addSecret').value='';
    if(openedFromLive) {
      var liveInp=document.getElementById('liveSecretInput');
      if(liveInp) {
        liveInp.value='';
        updateLiveTOTP();
      }
      openedFromLive=false;
    }
  }
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

/* ===== THEME SELECTION ===== */
function getThemePreference(){return localStorage.getItem('hv_theme')||'system'}
function setThemePreference(t){localStorage.setItem('hv_theme',t)}
function applyThemePreference(t){
  setThemePreference(t);
  document.documentElement.setAttribute('data-theme', t);
  var sel=document.getElementById('settingsTheme');
  if(sel)sel.value=t;
}

/* ===== TUTORIAL LANGUAGE ===== */
function getTutorialLangPreference(){return localStorage.getItem('hv_tutorial_lang')||'en'}
function switchTutorialLang(lang){
  localStorage.setItem('hv_tutorial_lang',lang);
  var view=document.getElementById('viewTutorial');
  if(view)view.setAttribute('data-lang',lang);
  var sel=document.getElementById('tutorialLang');
  if(sel)sel.value=lang;
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'SYNC_COMPLETE') {
      showToast('Sync complete! Refreshing...', false);
      loadAccounts();
    }
  });
}

// Focus-based revalidation (TanStack SWR style) for instant multi-device sync
window.addEventListener('focus', function() {
  if (isLoggedIn && isOnline) {
    loadAccounts();
  }
});

// Throttled sync on user interaction (clicks or touch starts, max once every 5 seconds)
var lastSyncTime = 0;
function triggerSyncOnInteraction() {
  var now = Date.now();
  if (now - lastSyncTime > 5000) {
    lastSyncTime = now;
    if (isLoggedIn && isOnline) {
      loadAccounts();
    }
  }
}
document.addEventListener('click', triggerSyncOnInteraction);
document.addEventListener('touchstart', triggerSyncOnInteraction);
