/* ===== TOTP ENGINE ===== */
function b32d(s){var a='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',t=s.replace(/[\s=-]/g,'').toUpperCase(),b='';for(var i=0;i<t.length;i++){var v=a.indexOf(t[i]);if(v>=0)b+=('00000'+v.toString(2)).slice(-5)}var r=[];for(var i=0;i+8<=b.length;i+=8)r.push(parseInt(b.substring(i,i+8),2));return new Uint8Array(r)}
async function hmac1(k,m){var key=await crypto.subtle.importKey('raw',k,{name:'HMAC',hash:'SHA-1'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,m))}
async function totp(secret){var k=b32d(secret),c=Math.floor(Math.floor(Date.now()/1000)/30),buf=new ArrayBuffer(8);new DataView(buf).setUint32(4,c,false);var h=await hmac1(k,new Uint8Array(buf)),o=h[h.length-1]&0x0f,bin=((h[o]&0x7f)<<24)|((h[o+1]&0xff)<<16)|((h[o+2]&0xff)<<8)|(h[o+3]&0xff),r=(bin%1000000).toString();while(r.length<6)r='0'+r;return r}

/* ===== REFRESH & TICK ===== */
async function refreshAll(){
  for(var i=0;i<accounts.length;i++){try{codes[i]=await totp(accounts[i].secret)}catch(e){codes[i]='ERROR'}}
  renderView();
  var ts=new Date().toLocaleTimeString();
  var tl=document.getElementById('timerLabel');if(tl)tl.textContent='Updated '+ts;
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

  if(left===30&&lastLeft!==30){
    refreshAll();
  }
  var isReset=(left===30&&lastLeft!==30)||(left===15&&lastLeft!==15);
  if(isReset&&isLoggedIn&&navigator.onLine){
    loadAccounts();
  }
  lastLeft=left;
}
