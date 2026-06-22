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
  btn.textContent='Logging in...';btn.disabled=true;
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
  }catch(e){
    var cached=localStorage.getItem('hv_cached_accounts');
    if(cached){
      try{
        var decrypted=await decryptData(cached,pw,user);
        if(decrypted){
          username=user.toLowerCase();
          password=pw;
          isLoggedIn=true;
          document.querySelectorAll('.private-nav').forEach(function(el){el.style.display='flex'});
          document.getElementById('sidebarUserSection').style.display='flex';
          document.getElementById('btnSidebarLogout').style.display='flex';
          document.getElementById('btnSidebarLogin').style.display='none';
          setSavedUser(username);
          setSavedPw(pw);
          err.classList.remove('show');
          document.getElementById('screenLogin').style.display='none';
          document.getElementById('screenApp').style.display='flex';
          showToast('Offline Mode. Access granted.',true);
          loadAccounts();
          btn.textContent='Login';btn.disabled=false;
          hideSplash();
          return;
        }
      }catch(errDec){}
    }
    err.textContent='Connection failed: '+e.message;err.classList.add('show');username='';password='';
  }
  btn.textContent='Login';btn.disabled=false;
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
  var inp=document.getElementById('apiUrlInputLogin');
  if(inp)inp.value=getApiUrl();
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
  var inp=document.getElementById('apiUrlInputLogin');
  if(inp)inp.value=getApiUrl();
  accounts=[];codes=[];username='';password='';clearSavedCreds();
  document.querySelectorAll('.private-nav').forEach(function(el){el.style.display='flex'});
  document.getElementById('sidebarUserSection').style.display='flex';
  document.getElementById('btnSidebarLogout').style.display='flex';
  document.getElementById('btnSidebarLogin').style.display='none';
  if(tickInterval){clearInterval(tickInterval);tickInterval=null}
  closeSidebar();
}
