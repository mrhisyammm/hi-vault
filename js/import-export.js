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

/* ===== EXPORT ALL TO GA QR (Protobuf encoder) ===== */
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
      var algoField = writeVarintField(4, 1);
      var digitsField = writeVarintField(5, 1);
      var typeField = writeVarintField(6, 2);
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

/* ===== GOOGLE AUTHENTICATOR QR IMPORT (Protobuf decoder) ===== */
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
    var value = 0, shift = 0;
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
    var value = 0, shift = 0;
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
