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
function toggleSort(){
  var btn=document.getElementById('btnSortAZ');
  if(sortMode==='none'){sortMode='az';btn.classList.add('active');btn.querySelector('.sort-label').textContent='A-Z'}
  else if(sortMode==='az'){sortMode='za';btn.querySelector('.sort-label').textContent='Z-A'}
  else{sortMode='none';btn.classList.remove('active');btn.querySelector('.sort-label').textContent='A-Z'}
  renderView();
}
function toggleSortFav(){
  var btn=document.getElementById('btnSortFav');
  if(sortModeFav==='none'){sortModeFav='az';btn.classList.add('active');btn.querySelector('.sort-label').textContent='A-Z'}
  else if(sortModeFav==='az'){sortModeFav='za';btn.querySelector('.sort-label').textContent='Z-A'}
  else{sortModeFav='none';btn.classList.remove('active');btn.querySelector('.sort-label').textContent='A-Z'}
  renderView();
}

function getSortedAccounts(list,mode){
  var items=list.map(function(a,i){return{a:a,c:codes[accounts.indexOf(a)]||'------',oi:accounts.indexOf(a)};});
  if(mode==='az')items.sort(function(a,b){return a.a.label.localeCompare(b.a.label)});
  else if(mode==='za')items.sort(function(a,b){return b.a.label.localeCompare(a.a.label)});
  else{
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
  if(isDragging)return;
  if(currentView==='accounts')renderCards('cardsContainer',accounts,document.getElementById('searchInput').value,true,sortMode);
  else if(currentView==='favorites'){
    var favs=accounts.filter(function(a){return a.fav});
    renderCards('cardsFavContainer',favs,document.getElementById('searchFav').value,false,sortModeFav);
  }
}

function renderCards(containerId,list,query,allowDrag,mode){
  var container=document.getElementById(containerId);
  query=(query||'').toLowerCase();
  if(!list.length){
    var isFav=containerId==='cardsFavContainer';
    if(isFav)container.innerHTML='<div class="empty-state"><span class="ms">star</span><p>No favorites yet. Star an account to see it here.</p></div>';
    else container.innerHTML='<div class="empty-state"><span class="ms">key</span><p>No accounts yet. Add one to get started.</p></div>';
    return;
  }
  var filtered=list.filter(function(a){return !query||a.label.toLowerCase().indexOf(query)!==-1});
  var items=getSortedAccounts(filtered,mode);
  if(!items.length){container.innerHTML='<div class="empty-state"><span class="ms">search_off</span><p>No matching accounts found.</p></div>';return}

  var now=Math.floor(Date.now()/1000),left=30-(now%30),prog=left/30;
  var dashOff=(CIRC*(1-prog)).toFixed(1);
  var ringColor=left<=5?'var(--error)':'var(--primary)';
  var numColor=left<=5?'var(--error)':'var(--on-surface)';
  var canDrag=allowDrag&&mode==='none'&&!query;

  var html='<div class="cards-grid">';
  for(var x=0;x<items.length;x++){
    var it=items[x],a=it.a,c=it.c,oi=it.oi;
    var ico=getIcon(a.label);
    var c1=c.substring(0,3),c2=c.substring(3);
    html+='<div class="card'+(a.fav?' fav':'')+'" data-oi="'+oi+'"'+(canDrag?' draggable="true" ondragstart="dStart(event)" ondragover="dOver(event)" ondragenter="dEnter(event)" ondragleave="dLeave(event)" ondrop="dDrop(event)" ondragend="dEnd(event)"':'')+' onclick="copyCode('+oi+')">';
    html+='<div class="card-copied" id="copied'+oi+'">Copied!</div>';
    html+='<div class="card-top"><div class="card-identity">';
    html+='<div class="card-icon"><span class="ms" style="color:'+ico.c+'">'+ico.i+'</span></div>';
    var starHtml=a.fav?'<span class="ms ms-fill" style="color:#f59e0b; font-size:16px; margin-left:6px; vertical-align:middle;" title="Favorite">star</span>':'';
    html+='<div class="card-info"><div class="card-label">'+esc(a.label)+starHtml+'</div><div class="card-sub">'+esc(a.secret.substring(0,4)+'****')+'</div></div></div>';
    html+='<div class="card-menu-container">';
    if(canDrag)html+='<div class="drag-handle card-btn" onclick="event.stopPropagation()"><span class="ms">drag_indicator</span></div>';
    html+='<button class="card-btn" onclick="event.stopPropagation();toggleCardMenu(event,'+oi+')" title="Menu"><span class="ms">more_vert</span></button>';
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
  var thisCard=event.target.closest('.card');
  document.querySelectorAll('.card').forEach(function(c){
    if(c!==thisCard)c.classList.remove('menu-open');
  });
  document.querySelectorAll('.card-dropdown').forEach(function(el){
    if(!thisCard||!thisCard.contains(el)){el.classList.remove('show');}
  });
  var d=thisCard?thisCard.querySelector('.card-dropdown'):null;
  if(d){
    d.classList.toggle('show');
    if(d.classList.contains('show')){
      thisCard.classList.add('menu-open');
    }else{
      thisCard.classList.remove('menu-open');
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
function isValidBase32Secret(secret) {
  var clean = secret.replace(/\s/g, '').toUpperCase();
  if (clean.length < 3) return false;
  return /^[A-Z2-7]+=*$/.test(clean);
}

async function doAddAccount(){
  var label=document.getElementById('addLabel').value.trim();
  var secret=document.getElementById('addSecret').value.trim().replace(/\s/g,'').toUpperCase();
  if(!label||!secret){showToast('Fill in both fields',true);return}
  if(!isValidBase32Secret(secret)){
    showToast('Invalid Base32 secret (min 8 chars, A-Z, 2-7)',true);
    return;
  }
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
  if(!isValidBase32Secret(secret)){
    showToast('Invalid Base32 secret (min 8 chars, A-Z, 2-7)',true);
    return;
  }
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
