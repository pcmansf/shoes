# Shoes' — Raspberry Pi edition

A shoe catalog with IDs, names, shoe and box photos, search, editing, archiving, and photo-inclusive backups. Every device connects to the same collection on your Pi.

## Install on your Raspberry Pi

This installer targets **64-bit Raspberry Pi OS with systemd**. It also supports 64-bit Debian/Ubuntu with the same prerequisites. It does not support a 32-bit OS.

1. Copy Shoes.zip to your Pi and extract it.
2. Open a terminal in the extracted Shoes folder.
3. Run:

       sudo bash deploy/install-pi.sh

The installer downloads the official Node.js 24.22.0 runtime, verifies its SHA-256 checksum, installs the application, and enables automatic startup. It prints your website address, username and a generated password.

Open the printed address on your phone or computer on the same home network:

    http://raspberrypi.local:3000

Your Pi's actual hostname replaces raspberrypi. You can also use its IPv4 address, for example http://192.168.1.50:3000. Sign in with the login printed by the installer. No ChatGPT or Render connection is needed.

The installer requires internet access once to obtain Node.js and OS utilities. The running application has no third-party packages. Importing photos from Google Drive requires internet access to Google's services.

## Where everything lives

| Item | Location |
| --- | --- |
| App | /opt/shoes |
| Node.js runtime dedicated to this app | /opt/shoes-node |
| Database | /var/lib/shoes/shoes.sqlite |
| Photos | /var/lib/shoes/photos |
| Login and network settings | /etc/shoes.env |
| Startup service | shoes.service |

Re-running the installer updates the app and preserves the database, photos and existing settings. Existing data from the Windows version is not imported automatically; use Export backup there and Restore backup on the Pi.

## Manage the server

Check status:

    sudo systemctl status shoes

See recent logs:

    sudo journalctl -u shoes -n 50 --no-pager

Restart or stop:

    sudo systemctl restart shoes
    sudo systemctl stop shoes

Read the login or edit configuration:

    sudo nano /etc/shoes.env

Restart the service after changing settings. Keep the password at least 8 characters long. The default username is shoes.

If the Pi's IP address changes, add its new origin to the comma-separated SHOES_ORIGINS value and restart. Each origin must include its scheme and port, for example http://192.168.1.50:3000. The hostname.local address can continue to work without editing the IP. A DHCP reservation on your router avoids changing addresses.

If you already use a firewall, allow inbound TCP 3000 from your home subnet. The installer does not modify firewall or router settings.

## Access and sharing

This is one password-protected household collection. All signed-in devices can see and edit the same pairs. The app replaces client-supplied identity headers, validates allowed hostnames, and checks the origin of writes.

The default is HTTP on your home network. HTTP Basic authentication does not encrypt the password in transit; use only a trusted home network. For access from outside home, use your VPN or an HTTPS reverse proxy. Do not expose port 3000 directly to the internet.

With an existing HTTPS reverse proxy, set SHOES_ORIGINS to your HTTPS origin, preserve the incoming Host header when forwarding, and bind SHOES_HOST to 127.0.0.1 if the proxy runs on the Pi. The app uses the configured scheme for origin checks and ignores untrusted forwarding headers.

## Photos and starter entries

New collections start empty. **The repository contains no collection database or shoe photos.**

Use Add a pair to upload your shoe and box photos, or Restore backup to transfer an existing collection. Legacy collage imports remain supported for existing entries.

For sharper images, use Edit pair to replace the photos with your originals. JPG, PNG, WebP and GIF are supported. Convert HEIC to JPG first.

Both photo slots also have **Choose from Google Drive** for browsing private Drive images. See [GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md) for the one-time Google configuration. Normal Pi network access needs HTTPS for Google sign-in; Windows localhost or an SSH tunnel can be used for testing. Imported images are copied to the Pi and included in backups.

## Backups

Replacing or removing a photo deletes the old file after the pair is saved, provided no other pair (including archived pairs) uses it. Temporary uploads are cleaned when an edit is canceled; unreferenced uploads older than 24 hours are also removed at startup and hourly. Exported backups retain their own embedded copies of photos.

Export backup downloads the full collection, archived pairs and photos. Keep a copy off the Pi. Restore backup adds new IDs and asks before replacing matching IDs; other records remain unchanged.

For a filesystem backup, stop shoes.service before copying the entire /var/lib/shoes directory, then restart it. Do not copy only a live SQLite file: its WAL may contain recent writes.

## Run without the installer

Node.js 22.13 or newer is required; Node.js 24 LTS is used by the installer. No npm install is needed.

For access only on the same computer:

    node server.mjs

Windows users can still use Start-Shoes.cmd. For network hosting, configure SHOES_HOST, SHOES_PORT, SHOES_ORIGINS, SHOES_USERNAME, SHOES_PASSWORD and optionally SHOES_DATA_DIR before starting. Network mode refuses to start without credentials and explicit allowed origins.

## Verification

The application tests cover database operations, persistence, backup restore, photos, server login, host validation, cross-site requests and shared access. Run:

    node test.mjs
    node server-test.mjs

The installer runs those tests before starting the service. Installation and reboot behavior still need verification on your actual Pi.

## Runtime references

- Official Node.js release and ARM64 binaries: https://nodejs.org/en/blog/release/v24.22.0
- Node.js SQLite: https://nodejs.org/docs/latest-v24.x/api/sqlite.html
- Raspberry Pi remote access: https://www.raspberrypi.com/documentation/computers/remote-access.html
- systemd service configuration: https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html
