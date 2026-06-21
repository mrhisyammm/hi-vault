var WEB_APP_USERNAME = "user";
var WEB_APP_PASSWORD = "password";

// ============================================================
// Hi-Vault — 2FA TOTP Generator
// Backend: Google Apps Script | Frontend: Vercel (index.html)
// ============================================================
// Sheet layout:
//   Row 1: Refresh checkbox
//   Row 2: Headers — Label | Secret Key | OTP Code | Fav
//   Row 3+: Data
//   Col A: Label, Col B: Secret, Col C: OTP formula, Col D: Fav (TRUE/FALSE)
//   Col Z: refresh timestamp (hidden)
// ============================================================

// --- TOTP Engine ---
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

/** @customfunction */
function TOTP(secret, _refresh) {
  if (!secret || secret === "") return "";
  return generateTOTP(secret.toString().replace(/\s/g, "").toUpperCase());
}

// --- Sheet Refresh ---
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

// ============================================================
// JSON API
// ============================================================
// Deploy: Deploy > New deployment > Web app
//   Execute as: Me | Access: Anyone
//
// Actions (all require pw param):
//   login          — verify password
//   accounts       — list all accounts [{label, secret, fav, row}]
//   add            — add account (label, secret)
//   delete         — delete account (row)
//   favorite       — toggle favorite (row)
//   reorder        — reorder all accounts (rows = JSON array of row numbers in new order)
// ============================================================

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
  var data = sheet.getRange(3, 1, lastRow - 2, 4).getValues(); // A:D
  var accounts = [];
  for (var i = 0; i < data.length; i++) {
    if (data[i][0] && data[i][1]) {
      accounts.push({
        label: data[i][0].toString(),
        secret: data[i][1].toString().replace(/\s/g, "").toUpperCase(),
        fav: data[i][3] === true || data[i][3] === "TRUE" || data[i][3] === true,
        row: i + 3 // actual sheet row
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
  // Rebuild OTP formulas for remaining rows
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
  // newOrder = array of current row numbers in the desired new order
  // e.g. [5, 3, 4] means: row5 first, row3 second, row4 third
  var sheet = _getSheet();
  var rows = JSON.parse(newOrder);
  if (!Array.isArray(rows) || rows.length === 0) return { success: false, error: "Invalid order" };

  // Read all current data
  var allData = [];
  for (var i = 0; i < rows.length; i++) {
    var r = parseInt(rows[i]);
    var label = sheet.getRange(r, 1).getValue();
    var secret = sheet.getRange(r, 2).getValue();
    var fav = sheet.getRange(r, 4).getValue();
    allData.push([label, secret, fav]);
  }

  // Write back in new order
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

  // Login check
  if (action === "login") {
    return { success: user === WEB_APP_USERNAME && pw === WEB_APP_PASSWORD };
  }

  // Auth gate for everything else
  if (user !== WEB_APP_USERNAME || pw !== WEB_APP_PASSWORD) {
    return { success: false, error: "Unauthorized" };
  }

  switch (action) {
    case "accounts":
      return { success: true, accounts: _getAccounts() };

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
      return {
        info: "Hi-Vault API",
        actions: ["login", "accounts", "add", "delete", "favorite", "reorder"]
      };
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

// ============================================================
// SETUP — run once, preserves existing data
// ============================================================
function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  sheet.setName("2FA Vault");

  // Ensure sheet has at least 26 columns and 100 rows to prevent out-of-bounds errors
  var maxCols = sheet.getMaxColumns();
  if (maxCols < 26) {
    sheet.insertColumnsAfter(maxCols, 26 - maxCols);
  }
  var maxRows = sheet.getMaxRows();
  if (maxRows < 100) {
    sheet.insertRowsAfter(maxRows, 100 - maxRows);
  }

  // Save existing data (A:D)
  var lastRow = Math.max(sheet.getLastRow(), 3);
  var existingData = sheet.getRange(3, 1, lastRow - 2, 4).getValues();

  sheet.clear();
  sheet.getRange("A1:Z" + lastRow).setFontFamily("Google Sans");

  // Row 1: Refresh
  sheet.setRowHeight(1, 32);
  sheet.getRange("A1:D1").setBackground("#e8fce8");
  sheet.getRange("A1").setValue(false);
  sheet.getRange("A1").insertCheckboxes();
  sheet.getRange("A1").setHorizontalAlignment("center").setVerticalAlignment("middle");
  var rl = sheet.getRange("B1:D1"); rl.merge();
  rl.setValue("Check to refresh all OTP codes");
  rl.setFontSize(9).setFontColor("#2d7a2d").setFontWeight("bold").setVerticalAlignment("middle");

  // Row 2: Headers
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

  // Restore data
  sheet.getRange(3, 1, existingData.length, 4).setValues(existingData);
  for (var i = 3; i <= 2 + existingData.length; i++) {
    sheet.getRange(i, 3).setFormula('=IF(B' + i + '="","",TOTP(B' + i + ',Z$1))');
    var favVal = sheet.getRange(i, 4).getValue();
    if (favVal === "" || favVal === null) {
      sheet.getRange(i, 4).setValue(false);
    }
  }

  // Hide helper columns
  sheet.hideColumns(26); // Z
  sheet.getRange("Z1").setValue(new Date().getTime());
  if (sheet.getMaxColumns() > 4) {
    // Hide cols 5 to 25 (E to Y)
    sheet.hideColumns(5, 21);
  }

  stopAutoRefresh();
  ScriptApp.newTrigger("refreshCodes").timeBased().everyMinutes(1).create();

  SpreadsheetApp.getUi().alert(
    "✅ Hi-Vault ready!\n\n" +
    "Deploy as Web App:\n" +
    "Deploy → New deployment → Web app\n" +
    "Execute as: Me | Access: Anyone\n\n" +
    "⚠️ Don\'t forget to change both username and password!\n" +
    "Find: var WEB_APP_USERNAME = \"...\" and var WEB_APP_PASSWORD = \"...\""
  );
}
