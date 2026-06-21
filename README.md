# Hi-Vault

Hi-Vault is a secure, institutional-grade, offline-first 2FA (Two-Factor Authentication) TOTP manager built on top of **Google Sheets** as a database and deployed as a static progressive web app (PWA).

## Features

- **AES-GCM 256-bit Cryptographic Encryption**: All your cached accounts and secret keys are encrypted locally on your device using a derived key (PBKDF2 with 100,000 iterations) from your password.
- **PWA (Installable Web App)**: Install Hi-Vault directly onto your mobile home screen or desktop PC for an app-like experience.
- **Offline-First Support**: View and generate TOTP codes fully offline. Any database changes (adding, deleting, or reordering accounts) made offline are queued locally and automatically synchronized back to Google Sheets once you are reconnected.
- **Live 2FA Decoder**: Generate OTP codes on-the-fly from any Base32 secret key (via typing, webcam scanning, or image uploading) without saving the key to your database.
- **Bulk Data Transfer**: Backup your accounts as an Excel-compatible CSV file, or import multiple accounts at once (including parsing Google Authenticator migration QR codes).
- **Smooth Drag & Drop Reordering**: Rearrange your accounts by dragging and dropping them, with changes synced back to your spreadsheet.
- **Favorites & Sorting**: Pin your favorite accounts to the top and sort them alphabetically.

## Getting Started

To get your own private instance of Hi-Vault running, follow these steps:

### 1. Set Up the Google Sheets Backend
1. Create a new Google Sheet (or rename an existing one).
2. Rename the active sheet tab to **2FA Vault**.
3. Open **Extensions > Apps Script** in the Google Sheet menu.
4. Copy the backend code from `google-sheets-2fa.js` in this repository, paste it into the Apps Script editor, and replace any default code.
5. **Configure Credentials:** At the very top of the script, change the username and password values to secure your database:
   ```javascript
   var WEB_APP_USERNAME = "your_username";
   var WEB_APP_PASSWORD = "your_password";
   ```
6. Select the function `setupSheet` from the dropdown menu at the top, and click **Run**. Grant the necessary Google account permissions.
7. Click **Deploy > New deployment**, select **Web app**, configure *Execute as: Me* and *Who has access: Anyone*, then click **Deploy** and copy the generated **Web App URL**.

### 2. Configure the Frontend
1. Open the Hi-Vault frontend (e.g. `hi-vault.vercel.app` or your local development server).
2. Click **API Configuration** at the bottom of the login card.
3. Paste your copied Google Sheets Web App URL and click **Save & Reload**.
4. Log in using the username and password you configured in the Apps Script.

## License

This project is open-source and available under the MIT License.
