# Hi-Vault

Hi-Vault is a secure, institutional-grade, offline-first 2FA (Two-Factor Authentication) TOTP manager built on top of **Google Sheets** as a database and deployed as a static progressive web app (PWA).

## Features

- **AES-GCM 256-bit Cryptographic Encryption**: All your cached accounts and secret keys are encrypted locally on your device using a derived key (PBKDF2 with 100,000 iterations) from your password.
- **PWA (Installable Web App)**: Install Hi-Vault directly onto your mobile home screen or desktop PC for an app-like experience. Offline launching is fully supported via PWA Service Worker caching.
- **Offline-First with State Reconciliation**: View and generate TOTP codes fully offline. Add, edit, delete, favorite, or reorder accounts offline; changes are queued locally in IndexedDB and automatically synced to Google Sheets once you reconnect. An in-memory state reconciliation engine guarantees that offline modifications never disappear or flicker during network transitions.
- **Real-Time Cross-Device Sync**: Revalidates and fetches new data from Google Sheets in the background whenever you focus the window, interact with the UI (throttled at 5 seconds), or every 15 seconds automatically. Multiple devices stay updated in real time.
- **Live 2FA Decoder**: Generate OTP codes on-the-fly from any Base32 secret key (via typing, webcam scanning, or image uploading) without saving the key to your database. Includes a one-click "Add to My Accounts" modal flow.
- **Bulk Data Transfer**: Backup your accounts as an Excel-compatible CSV file, or import multiple accounts at once (including parsing Google Authenticator protobuf migration QR codes or raw base32 keys).
- **Smooth Drag & Drop Reordering**: Rearrange your accounts by dragging and dropping them, with changes synced back to your spreadsheet.
- **Favorites & Sorting**: Pin your favorite accounts to the top with a gold star badge and sort them alphabetically.
- **Sleek Sentry-inspired UI**: Premium dark/light themes that respect your system settings by default, with custom saturated icon filters and a clean monochrome dark theme.
- **Setup Tutorial & About Views**: Fully bilingual (English & Indonesian) guides explaining setup steps and outlining the core architectural advantages of Hi-Vault over standard proprietary authenticators.

## Why Hi-Vault?

Standard authenticator apps (like Google Authenticator, Microsoft Authenticator, or Authy) store your 2FA keys in proprietary, closed-source cloud databases. This means you do not own your data—you are at the mercy of corporate lock-ins, subscription pricing, potential security leaks, and hidden analytics trackers.

Hi-Vault is a completely **self-hosted, open-source, and private** alternative. It uses your own Google Drive spreadsheet (via a lightweight Google Apps Script Web App) as the database. You own the infrastructure, the code is transparent, and all local caches are encrypted using military-grade cryptography on your device.

### Feature Comparison

| Feature | **Hi-Vault** | **Google Authenticator** | **Others (Authy, MS, etc.)** |
| :--- | :--- | :--- | :--- |
| **Data Ownership** | 🟢 **You (Your Google Drive)** | 🔴 Google Cloud | 🔴 Corporate Cloud |
| **Source Code** | 🟢 **Open Source (MIT)** | 🔴 Closed Source | 🔴 Closed Source |
| **Offline-First Sync** | 🟢 **Yes (IndexedDB Queue)** | 🔴 No (Needs network) | 🔴 No (Needs network) |
| **Export Formats** | 🟢 **CSV, QR, Migration Protobuf** | 🟡 Migration QR Only | 🔴 None / Proprietary |
| **Privacy / Trackers** | 🟢 **None (0 trackers)** | 🔴 Google Analytics | 🔴 Ad/Analytics SDKs |
| **Encryption** | 🟢 **AES-GCM 256-bit + PBKDF2** | 🟡 Cloud Synced (No E2EE by default) | 🟡 Encrypted by Host |

## Directory Structure

The project has been restructured into clean, modular directories:

```
2FA/
├── assets/
│   └── icons/              # PWA launch icons
│       ├── icon-192x192.png
│       └── icon-512x512.png
├── backend/
│   └── google-sheets-2fa.js # Google Apps Script backend engine
├── css/
│   └── style.css           # Sentry Core design system styles
├── js/
│   ├── accounts.js         # Account CRUD, favorites, sorting & rendering
│   ├── app.js              # State, routing, offline queue, settings & toast
│   ├── auth.js             # Login flow, auto-login, PWA installer & lock
│   ├── crypto.js           # IndexedDB wrapper & AES-GCM encryption
│   ├── drag.js             # Drag-and-drop & touch reordering logic
│   ├── import-export.js    # CSV & QR processing, Protobuf migration parser
│   ├── totp.js             # TOTP generation & refresh ticker
│   └── tutorial.js         # Backend GAS template string
├── index.html              # Main HTML skeleton
├── sw.js                   # Service worker cache strategy (v4.0+)
├── manifest.json           # PWA installation manifest
└── README.md
```

## Getting Started

To get your own private instance of Hi-Vault running, follow these steps:

### 1. Set Up the Google Sheets Backend
1. Create a new Google Sheet on your Google Drive.
2. Rename the active sheet tab to **2FA Vault**.
3. Open **Extensions > Apps Script** in the Google Sheet menu.
4. Copy the backend code from `backend/google-sheets-2fa.js` in this repository, paste it into the Apps Script editor, and replace any default code.
5. **Configure Credentials:** At the very top of the script (lines 1 & 2), change the username and password values to secure your database:
   ```javascript
   var WEB_APP_USERNAME = "your_username";
   var WEB_APP_PASSWORD = "your_password";
   ```
6. Select the function `setupSheet` from the dropdown menu at the top, and click **Run**. Grant the necessary Google account permissions.
7. Click **Deploy > New deployment**, select **Web app**, configure *Execute as: Me* and *Who has access: Anyone*, then click **Deploy** and copy the generated **Web App URL**.

### 2. Configure the Frontend
1. Open the Hi-Vault frontend (e.g. `hi-vault.vercel.app` or your local development server).
2. Click **API Configuration** at the bottom of the login card.
3. Paste your copied Google Sheets Web App URL and click **Save URL**.
4. Log in using the username and password you configured in the Apps Script.

## License

This project is open-source and available under the MIT License.
