# Shoes on Home Assistant OS

Shoes runs alongside Home Assistant in its own container. It does not replace Home Assistant OS. Supported devices are 64-bit Raspberry Pi (`aarch64`) and Intel/AMD (`amd64`).

## Install

1. Open **Settings → Apps → App store**. Older Home Assistant versions call these **Add-ons** and **Add-on store**.
2. Open the three-dot menu → **Repositories** and add:

   ```text
   https://github.com/pcmansf/shoes
   ```

3. Refresh the store, select **Shoes Collection**, and select **Install**. The initial image build can take several minutes.
4. Open **Configuration**. Under **Allowed addresses**, keep the hostname address if you use it and add the exact IP address you will open, with its scheme and port. For example, for a device at `192.168.1.50`:

   ```yaml
   require_login: true
   username: shoes
   password: "REPLACE_WITH_YOUR_PASSWORD"
   origins:
     - "http://homeassistant.local:8099"
     - "http://192.168.1.50:8099"
   ```

5. Choose a password of at least **8 characters**. Alternatively, turn **Require login** off; the password is then optional.
6. Save, start the app, enable **Start on boot**, and open its web UI.

Use your own Home Assistant address in place of the example. Open `http://YOUR_HOME_ASSISTANT_IP:8099` on devices connected to your home network. You do not need the Home Assistant phone app or a Home Assistant account to use Shoes. The Shoes login, when enabled, is separate from Home Assistant and SSH logins.

New installations start empty. Use **Add a pair**, or **Restore backup** to import a backup exported by an existing Shoes installation.

## Configuration

| Setting | Meaning |
| --- | --- |
| Require login (`require_login`) | Defaults to on. Turn off to skip the Shoes password prompt. |
| Username (`username`) | The Shoes login name; defaults to `shoes`. |
| Password (`password`) | At least 8 characters when login is on. Not used when login is off. |
| Allowed addresses (`origins`) | Every address you use to reach Shoes, including scheme and port. No extra path is allowed. |
| Google client ID / API key / app ID | Optional settings for Google Drive's image picker. See the repository's Google Drive setup guide. |

Save and restart Shoes after changing settings. Turning login off keeps your saved credentials and collection; turn it back on to require those credentials again. Allowed-address checks still apply with login off. All people with access share the same collection and can edit it.

If login is off, anyone who can reach the app can view and change the collection. HTTP does not encrypt traffic or login credentials. Use a trusted home network; for remote access use a VPN or an appropriately configured HTTPS reverse proxy. Do not expose the app's port directly to the internet.

If you change the host port in the app's **Network** section, also change that port in Allowed addresses. The container's internal port remains `8099`.

## Storage and backups

The app stores these files in its own persistent Home Assistant data volume:

| Item | Container path |
| --- | --- |
| SQLite database | `/data/shoes/shoes.sqlite` |
| Photos | `/data/shoes/photos/` |
| Home Assistant app options | `/data/options.json` |

These are container paths, not folders inside the Samba source-code share. Restarting, rebuilding, or updating the **same app installation** preserves its data. Uninstalling can remove that data.

Use **Export backup** inside Shoes for a portable JSON backup containing records and photos. Save it somewhere off the Home Assistant device. **Restore backup** imports it into another Shoes installation and asks before replacing matching IDs. Keep a current export before updating or uninstalling.

You can also include Shoes Collection in a Home Assistant backup. The app requests a cold backup so Home Assistant stops it while copying its database and photos. Confirm that the app is selected in the backup. Do not copy just a running SQLite database file, because recent writes may still be in its accompanying WAL file.

## Update an installation from this repository

1. Export a Shoes backup and save it off the device.
2. Refresh the Home Assistant app store or check for updates.
3. Open Shoes Collection and select **Update** when a newer version appears.
4. Start it if needed, reload the browser, and check your collection.

The update uses the same persistent data volume. Fresh-install behavior does not reset an existing collection.

## Move from a local installation to this repository

A manually installed local app and the repository app have different Home Assistant identities and separate data volumes, even if both are called Shoes Collection. Adding this repository does **not** automatically move data or convert the existing app.

1. In your working local Shoes app, select **Export backup**. Save the file off the device and keep the local app installed.
2. Add this repository and install its Shoes Collection app.
3. Before starting the new app, expand its **Network** section and change the host port from `8099` to an unused port such as `8100`. This lets the old app keep running on `8099`.
4. Configure the new app with your chosen login settings and Allowed addresses using port `8100`, for example `http://192.168.1.50:8100` with your own IP.
5. Start it, open that address, and select **Restore backup**. Check your pair count and open several shoe and box photos.
6. Once satisfied, stop the old local app and turn off its **Start on boot**. Keep it installed as a fallback until you are comfortable with the new copy.
7. Optionally change the new app's host port to `8099`, update its Allowed addresses to match, then restart it. Update any bookmarks if you keep port `8100`.

Keep the exported backup. Uninstalling the old app is optional and should only happen after the new collection is verified.

## Keep using a local installation

You can continue updating the local app without migrating:

1. Export a backup first.
2. Download the repository source and copy the **contents of `shoes_collection/`** into your existing local Shoes source folder on the Home Assistant Samba share. The share may be called `addons` or `local_apps`; some setups show both names for the same location. Keep the existing app folder and `slug: shoes_collection` so its identity stays the same.
3. Refresh/check for updates in Home Assistant. If an update appears, install it; otherwise use the existing app's **Rebuild** action to rebuild its local source.
4. Start Shoes and check your collection. Do not uninstall it to force an update.

For a fresh local installation, put the `shoes_collection` folder directly inside the local apps/add-ons source share, refresh the store, and install it from **Local apps**. The folder containing `config.yaml` must be immediately under that share.

## Troubleshooting

- **The app will not start:** Read its Log tab. With login on, both a username and a password of at least 8 characters are required. At least one valid Allowed address is always required.
- **This hostname is not configured:** Add the exact browser address, including its scheme and port, to Allowed addresses, then restart the app.
- **A phone cannot connect:** Use `http://` explicitly, confirm it is on the same home network rather than a guest network, and check whether the same address works from another device. If Android shows a Chrome local-network or Nearby devices permission, allow it. A carrier's Network lock status is unrelated to this app.
- **The browser still asks for a password after disabling login:** Save and restart the app, then try a new private browsing tab. Browsers can remember HTTP authentication state.
- **Port is already in use:** Choose a free host port in Network and update Allowed addresses to use it.
- **No update is available:** Check whether you installed the local or repository copy. They update independently. For local source changes, rebuild the existing local app.
- **Google Drive sign-in fails on HTTP:** Google sign-in requires an eligible HTTPS origin for network access. Ordinary file uploads and backup restore do not require Google Drive.

Source and general documentation: [github.com/pcmansf/shoes](https://github.com/pcmansf/shoes).
