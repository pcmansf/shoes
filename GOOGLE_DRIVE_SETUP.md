# Import photos from your private Google Drive

Open **Add a pair** or **Edit pair**, then use **Choose from Google Drive** below either the shoe photo or the box photo. Sign in, choose one image, and click **Save pair** in the shoe editor.

The Google connection needs the one-time configuration below before it will work. No credentials are included in this repository. You can test locally on Windows before moving to your Raspberry Pi.

## Home Assistant app

Complete the Google project setup below, then enter your client ID, API key, and project number in **Shoes Collection → Configuration** using the three optional Google settings. Save and restart Shoes. Do not follow the `/var/lib/shoes`, systemd, or SSH instructions below on Home Assistant OS; those apply to Raspberry Pi OS.

For Google sign-in from phones or other computers, use an approved HTTPS origin, register it with Google, and add it to the app's **Allowed addresses** setting. The app stores imported photos in `/data/shoes/photos/`. Ordinary file uploads and backups work without Google configuration.

## 1. Create your Google app

In [Google Cloud Console](https://console.cloud.google.com/):

1. Create or select one project. Use this same project for all credentials below.
2. Enable **Google Drive API** and **Google Picker API** in APIs & Services.
3. Configure Google Auth Platform branding and audience. For personal testing, choose an External audience, leave the publishing status as Testing, and add your own Google email as a test user. A managed Workspace account may have additional administrator restrictions.
4. In Data Access, add `https://www.googleapis.com/auth/drive.file`. This scope limits access to files you select through this app. The app only downloads the selected image; it does not edit, delete, or change sharing on your Drive files.
5. Create an **OAuth client ID** with application type **Web application**. Under Authorized JavaScript origins, add these four entries:

   ```text
   http://localhost
   http://localhost:5173
   http://127.0.0.1
   http://127.0.0.1:5173
   ```

   This app uses the browser popup token flow. It does not need an authorized redirect URI or a client secret.

6. Create an **API key** in the same project. Set application restrictions to **Websites**, adding:

   ```text
   http://localhost:5173/*
   http://127.0.0.1:5173/*
   https://docs.google.com/*
   ```

   Set API restrictions to **Google Picker API** and **Google Drive API**. Keep these restrictions when adding your Pi's eventual HTTPS address.

7. Find the project's **project number** on its dashboard. Use the numeric number, not the project name or project ID.

## 2. Add the configuration on Windows

Start Shoes once using `Start-Shoes.cmd` so its `data` folder exists. Copy `ui/drive-config.example.json` to `data/google-drive.json` in your extracted Shoes folder. Edit the three values:

```json
{
  "clientId": "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com",
  "apiKey": "YOUR_GOOGLE_API_KEY",
  "appId": "YOUR_NUMERIC_GOOGLE_CLOUD_PROJECT_NUMBER"
}
```

Keep quotes around the project number. Make sure the file is named `google-drive.json`, not `google-drive.json.txt`. Do not put a client secret or an access token in this file.

Open <http://127.0.0.1:5173> or <http://localhost:5173>, edit a pair, and choose a Google Drive photo. Allow popups for this app if prompted. Close and reopen the picker after changing the configuration; a server restart is not needed.

## 3. Configure the Raspberry Pi

After installing Shoes, copy the completed configuration to `/var/lib/shoes/google-drive.json` and set permissions:

```sh
sudo chown shoes:shoes /var/lib/shoes/google-drive.json
sudo chmod 600 /var/lib/shoes/google-drive.json
```

For example, from the extracted Shoes directory you can copy an edited template with:

```sh
sudo install -o shoes -g shoes -m 600 ui/drive-config.example.json /var/lib/shoes/google-drive.json
```

Only run that copy command after replacing the template's placeholder values. The normal Pi installer preserves your existing data and configuration. You can also provide the same values through `SHOES_GOOGLE_CLIENT_ID`, `SHOES_GOOGLE_API_KEY`, and `SHOES_GOOGLE_APP_ID`; environment values override the JSON fields and require a service restart when changed.

### Normal access from phones and other computers

Google sign-in requires an HTTPS origin for normal network access. The default `http://raspberrypi.local:3000` or a plain HTTP LAN IP address will not work for the picker.

Use an HTTPS reverse proxy with a domain you control and a trusted certificate. Add the exact app origin, such as `https://shoes.example.com`, to your OAuth client's Authorized JavaScript origins. Add `https://shoes.example.com/*` to the API key's allowed websites. The example domain is a placeholder; use your actual domain.

Add that same HTTPS origin to the comma-separated `SHOES_ORIGINS` setting in `/etc/shoes.env`. Preserve the incoming Host header when proxying to the app. When the proxy runs on the Pi, bind the app to `127.0.0.1`. Then restart it:

```sh
sudo systemctl restart shoes
```

### Test the Pi from Windows without configuring HTTPS

An SSH tunnel lets your Windows browser use the approved localhost address while images are saved on the Pi. SSH must be enabled on the Pi.

1. On the Pi, edit `/etc/shoes.env` with `sudo nano /etc/shoes.env`. Append `,http://localhost:5173` to the existing `SHOES_ORIGINS` value, keeping its other addresses. Run `sudo systemctl restart shoes`.
2. Stop any Windows Shoes server using port 5173.
3. In Windows PowerShell, run the following command, replacing `YOUR_PI_USER` and the hostname with your actual Pi login and hostname:

   ```powershell
   ssh -N -L 5173:127.0.0.1:3000 YOUR_PI_USER@raspberrypi.local
   ```

4. Keep the SSH window open and visit <http://localhost:5173>. Sign in with the Shoes username and password printed by the Pi installer. The Google origins configured above already cover this address.

## Storage and supported images

- Selected photos are downloaded in your browser, resized to a maximum of 1800 pixels per side, converted to JPEG, and uploaded to the shoe server. Click **Save pair** to attach the image to the record.
- On Windows, images are saved under `data/photos`; on the Pi, under `/var/lib/shoes/photos`. Export backup includes the images and collection records. You can export on Windows and restore on the Pi.
- Google access tokens stay in the picker window's memory. They are not saved in the configuration, stored in the collection, or sent to the shoe server.
- JPG, PNG, WebP, and GIF images up to 20 MB are supported. GIF imports become a still image. Convert HEIC to JPG first. Files with downloading disabled cannot be imported.
- This is a copy, not an ongoing sync. Later Drive edits do not change an imported photo, and deleting an image from Drive does not remove its saved copy from Shoes.
- Existing saved photos and ordinary file uploads work without a Google connection.

## If the picker does not open

Check that you used a Web application OAuth client, all credentials belong to the same project, both APIs are enabled, your Google account is an allowed test user, and the browser address exactly matches an authorized origin. Google configuration changes can take time to take effect. Reopen the picker and sign in again after fixing settings.

Automated tests cover configuration, message validation, simulated Drive downloads, image storage, and persistence. Actual Google sign-in and the live Picker still need to be checked using your configured Google account.

Official references: [Google Picker setup](https://developers.google.com/workspace/drive/picker/guides/web-picker), [browser token flow](https://developers.google.com/identity/oauth2/web/guides/use-token-model), and [Drive downloads](https://developers.google.com/workspace/drive/api/guides/manage-downloads).
