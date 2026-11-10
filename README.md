# Shoes Collection

A private household shoe catalog with shoe and box photos, storage locations, search, seasonal filters, and **Stored / Taken out** status. Phones and computers can use the same collection through a browser.

**Version 1.6.2** runs as a Home Assistant app (formerly called an add-on), on Windows, or on 64-bit Raspberry Pi OS. New installations start empty. This repository contains application code and synthetic tests, with no collection database, personal shoe photos, or backups.

## Install on Home Assistant OS

This is the installation method for a Raspberry Pi already running Home Assistant OS. It keeps Home Assistant in place and stores Shoes separately.

[Add this repository to Home Assistant](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fpcmansf%2Fshoes)

1. In Home Assistant, open **Settings → Apps → App store** (older versions say **Add-ons**).
2. Open the three-dot menu → **Repositories**, add `https://github.com/pcmansf/shoes`, and refresh the store.
3. Find **Shoes Collection** and select **Install**. The first installation builds the app and can take several minutes.
4. In **Configuration**, add the address you will open to **Allowed addresses**, including `http://`, your Home Assistant IP or hostname, and port `8099`.
5. Keep **Require login** on and set a password of at least **8 characters**, or turn it off for password-free access on your trusted home network.
6. Save, start the app, enable **Start on boot**, and select **Open Web UI**.

Open `http://YOUR_HOME_ASSISTANT_IP:8099` on a phone or computer connected to your home network. The Home Assistant phone app is not required.

**Already using the manually installed local Shoes app?** Keep it installed and read the [migration instructions](shoes_collection/DOCS.md#move-from-a-local-installation-to-this-repository) before installing the repository version. They have separate storage; installation alone does not move your collection.

See the [complete Home Assistant instructions](shoes_collection/DOCS.md) for configuration, backups, updates, and troubleshooting.

## Your collection and backups

Use **Add a pair** to upload shoe and box photos. Manage named storage locations and icons, edit entries, archive pairs, or mark them **Taken out** without losing their usual location.

**Export backup** downloads records and their photos together. Keep a copy outside the device running Shoes. **Restore backup** transfers an existing collection; it asks before replacing matching IDs. Replacing or removing a saved photo removes its unused file, so keep exported backups if you want older copies.

Home Assistant stores the database and photos in the app's persistent `/data/shoes` directory. Restarting or rebuilding the same app preserves that directory. Uninstalling the app can remove it: export a backup first.

## Run on Windows

Install Node.js 22.13 or newer, then double-click `Start-Shoes.cmd` and open `http://127.0.0.1:5173`. Keep the server window open. No `npm install` is needed.

For an update, stop Shoes, replace application files, and keep your existing `data` folder. Start Shoes again and refresh the browser. Removing the old starter examples from the code does not remove entries in an existing database.

## Run on Raspberry Pi OS

For **64-bit Raspberry Pi OS or Debian/Ubuntu with systemd**, follow [PI_SETUP.md](PI_SETUP.md). That installer does not apply to Home Assistant OS; use the Home Assistant app above instead.

## Optional Google Drive import

See [GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md). Home Assistant users can enter the three Google settings in the app's Configuration tab. Google sign-in on a network address requires HTTPS; ordinary uploads and backups work over your home network's HTTP connection.

## Development

Node.js 22.13 or newer is required; the Home Assistant image uses Node.js 24. There are no third-party runtime packages. SQLite is provided by Node.js.

```sh
npm test
npm run build
npm run check:addon
npm run check:privacy
```

The root `server.mjs`, `run.mjs`, `src/`, `ui/`, and `drizzle/` files are the canonical runtime source. `npm run build` copies only those approved source files into `shoes_collection/`, which is a self-contained Home Assistant build context. After a runtime change, run the build and commit both copies. Keep versions in `package.json`, `shoes_collection/config.yaml`, and the Dockerfile label in sync.

Tests use temporary databases and synthetic records/images. Continuous integration checks the application, empty first-run behavior, optional login, 8-character minimum password, source synchronization, private-data exclusions, and the Docker build.

## Keep collection data private

The ignore rules exclude databases, photos, backups, local options, and credentials. Before publishing changes, stage the intended source files and run `npm run check:privacy`; it checks tracked files, including newly staged files. These checks are safeguards, not a substitute for reviewing what you upload.

An earlier commit accidentally included personal collection data. The public history was replaced to remove it. If you cloned that version, make a fresh clone for code changes and keep any local collection backup outside Git. Do not merge or push the old history back into this repository.
