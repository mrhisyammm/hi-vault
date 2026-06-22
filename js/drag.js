/* ===== DRAG & DROP REORDER (Desktop) ===== */
function dStart(e){
  var card=e.target.closest('.card');
  dragSrcIndex=parseInt(card.dataset.oi);
  card.classList.add('dragging');
  isDragging=true;
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
  isDragging=false;
  doReorder(dragSrcIndex,targetIndex);
}
function dEnd(e){
  document.querySelectorAll('.card').forEach(function(c){c.classList.remove('dragging','drag-over')});
  dragSrcIndex=null;
  isDragging=false;
}

/* ===== TOUCH DRAG (Mobile) ===== */
var touchDragEl=null,touchDragOi=null,touchClone=null,touchStartX=0,touchStartY=0,touchOffsetX=0,touchOffsetY=0;
var isDragging=false;

function cleanupTouchDrag(){
  document.querySelectorAll('.touch-drag-clone').forEach(function(el){el.remove()});
  document.querySelectorAll('.card').forEach(function(c){c.classList.remove('dragging','drag-over')});
  touchClone=null;touchDragEl=null;touchDragOi=null;
  isDragging=false;
}

document.addEventListener('touchstart',function(e){
  var handle=e.target.closest('.drag-handle');
  if(!handle)return;
  var card=handle.closest('.card');
  if(!card)return;
  e.preventDefault();
  cleanupTouchDrag();
  isDragging=true;
  touchDragEl=card;
  touchDragOi=parseInt(card.dataset.oi);
  touchStartX=e.touches[0].clientX;
  touchStartY=e.touches[0].clientY;
  touchClone=card.cloneNode(true);
  touchClone.className='touch-drag-clone';
  touchClone.style.cssText='position:fixed;opacity:0.85;z-index:9999;pointer-events:none;transform:rotate(2deg) scale(1.03);width:'+card.offsetWidth+'px;border-radius:14px;box-shadow:0 12px 40px rgba(9,30,66,.25);transition:none;';
  var rect=card.getBoundingClientRect();
  touchOffsetX=touchStartX-rect.left;
  touchOffsetY=touchStartY-rect.top;
  touchClone.style.left=rect.left+'px';
  touchClone.style.top=rect.top+'px';
  document.body.appendChild(touchClone);
  card.classList.add('dragging');
},{passive:false});

document.addEventListener('touchmove',function(e){
  if(!isDragging||!touchClone)return;
  e.preventDefault();
  var touch=e.touches[0];
  touchClone.style.left=(touch.clientX-touchOffsetX)+'px';
  touchClone.style.top=(touch.clientY-touchOffsetY)+'px';
  var el=document.elementFromPoint(touch.clientX,touch.clientY);
  document.querySelectorAll('.card').forEach(function(c){c.classList.remove('drag-over')});
  if(el){var tc=el.closest('.card');if(tc&&tc!==touchDragEl)tc.classList.add('drag-over')}
},{passive:false});

document.addEventListener('touchend',function(e){
  if(!isDragging)return;
  var savedOi=touchDragOi;
  var savedEl=touchDragEl;
  var touch=e.changedTouches[0];
  cleanupTouchDrag();
  var el=document.elementFromPoint(touch.clientX,touch.clientY);
  if(el){var tc=el.closest('.card');if(tc&&tc!==savedEl){var targetOi=parseInt(tc.dataset.oi);if(savedOi!==null&&!isNaN(targetOi)&&targetOi!==savedOi)doReorder(savedOi,targetOi)}}
});

document.addEventListener('touchcancel',function(){cleanupTouchDrag()});
setInterval(function(){if(!isDragging)document.querySelectorAll('.touch-drag-clone').forEach(function(el){el.remove()})},3000);

/* ===== REORDER API ===== */
var reorderTimeout=null;

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

  clearTimeout(reorderTimeout);
  reorderTimeout=setTimeout(async function(){
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
      showToast('Order synced to cloud');
    }catch(e){
      if(!isOnline){
        addToOfflineQueue('reorder',{rows:JSON.stringify(rows)});
        setOnline(false);
        showToast('Offline Mode. Reorder queued.',true);
      }else{
        showToast('Sync failed: '+e.message,true);
      }
    }
  },1500);
}
