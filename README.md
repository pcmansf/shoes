# Shoes'

## Host on your Raspberry Pi

See [PI_SETUP.md](PI_SETUP.md) for full instructions. On 64-bit Raspberry Pi OS, extract this archive and run from the Shoes folder:

    sudo bash deploy/install-pi.sh

The installer prints the web address and generated login. It stores the collection on your Pi and configures automatic startup. Open the printed address from devices on your home network.

## Run on a Windows computer

Double-click Start-Shoes.cmd, then open http://127.0.0.1:5173. Keep the server window open while using the app. Node.js 22.13 or newer is required; the launcher can use ChatGPT's bundled Node.js runtime.

## Your collection

New collections start empty. Use Add a pair or Edit pair to upload shoe and box photos. Export backup includes photos and records. Restore backup can transfer your existing collection to the Pi.

## Update an existing Windows installation

Close the Shoes server window. Extract this ZIP and copy the contents of its Shoes folder into your existing Shoes folder, replacing application files. Keep your existing data folder: it contains your records, images, and optional Google configuration. This ZIP does not contain a data folder. Start Start-Shoes.cmd again and reload your browser with Ctrl+F5.

Version 1.6.0 adds Stored and Taken out status. Existing pairs and older backups default to Stored. Choose the status when editing a pair, or use Take out / Put back in its details window. Taking a pair out keeps its usual storage location and photos. Taken-out thumbnails have an amber background, border, and badge; the full photo stays visible.

Filter by location (including No location), and choose Show both, Stored, or Taken out. These work together with search, category, and season. Clear filters resets them all. Location renames keep the selected location filter. Backups include storage status, and changing status is covered by the editor's unsaved-changes warning.

Version 1.5.1 refines the layout: Edit is smaller and keeps its dark green hover highlight; location textboxes, icons, Save, and Delete line up; the icon picker shows only icons and now includes a TV option. Existing location icon choices are preserved.

Locations also checks for unsaved changes to names, icons, and the new-location form before closing. Cancel keeps those edits. Saving one row preserves unfinished edits in other rows, and refreshing/navigating away uses the browser's unsaved-changes warning.

Delete location, Remove photo, and Archive pair each ask for confirmation. Their Do not show again checkbox remembers a separate preference for that action in this browser. Canceling a confirmation leaves both the item and that preference unchanged. Open Confirmations in the menu to turn any prompt back on. Unsaved-change warnings remain active. Photo removal is applied when the pair is saved; archive keeps the pair and its photos available for restoration. Automatic cleanup of replaced or unused photo files continues as before.

Version 1.5.0 fixes the details window closing when resized. Its dedicated lower-right handle keeps the top-left corner still while you drag, stays within the screen, and also works with arrow keys (Shift for larger steps). Only an outside press and release closes a window; resize gestures and drags from inside it do not.

Locations now have 37 selectable icons for rooms, garage, closets, storage, workshop, garden, and other places. Open Locations, click the icon beside a location, choose one, and press Save. You can also choose an icon when adding a new location. Icons appear beside locations on cards, in pair details, and next to the editor's selected location. Existing locations start with the location pin; names, assigned pairs, records, and photos stay intact. Backup export includes icons. Older backups still work and preserve icons already assigned to existing locations.

Card Edit buttons have a compact 32-pixel-tall click area and turn dark green on hover or keyboard focus. Clicking anywhere inside the Edit button, including its pencil, opens the editor. Other areas of a card open the preview.

Cards use larger box IDs and show each pair's location. An empty brand is hidden. Open Locations in the menu (or Manage locations in the editor) to add, rename, or delete dropdown choices. Existing locations are imported automatically without changing shoe records. Renaming a location updates its active and archived pairs; deletion is allowed only when no pairs use it. Backup export includes unused location choices too.

The details window opens at 80% of the screen width on desktop. Drag its lower-right corner to resize it. It shows category, season, brand when provided, location, match and archive status, notes, and saved dates. On small screens the window fits the viewport automatically. The visible hover instruction is removed; photo zoom is unchanged.

Closing the pair editor with its X, Cancel, Escape, or an outside click asks before discarding changed text, selections, or photos. Canceling that confirmation keeps the editor and its uploads intact. An unchanged form closes without a prompt; saving successfully also closes without a prompt. Browser refresh/navigation uses the browser's standard unsaved-changes warning. Archiving with unsaved form edits asks before discarding those edits.

Season choices are All-season (the default), Spring, Summer, Fall, and Winter. Choose one in the editor and filter by season independently of shoe category. Any season shows everything; each named season filter shows that exact selection. Existing entries and older backups default to All-season. Names are optional: a blank name saves as Shoes.

After a replacement or removal is saved, photos no longer used by any pair are deleted. Shared photos and photos used by archived pairs stay. Canceling an edit removes its temporary uploads, while failed saves keep the original photos. A startup and hourly cleanup also removes unreferenced uploads older than 24 hours, including abandoned uploads from earlier versions. Saved photos are never removed by that cleanup. Keep your exported backups if you want historical copies.

Thumbnails display the full shoe and box photo, including portrait photos. Open a pair, then hover over either photo to magnify it 2.5 times. Move the pointer to pan and move away to return to the full image. Keyboard: Tab to a photo to zoom, arrow keys to pan, Escape to reset. Touch scrolling is unchanged. Zoom uses the saved image; existing photos do not need to be uploaded again.

The editor and Confirm match share the same save logic. Photos and edits can be saved with the review checkbox unchecked; Confirm match only marks a pair as reviewed.

## Import from Google Drive

Both photo slots have a Choose from Google Drive button for browsing private files. Follow [GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md) for the required one-time Google configuration. Windows localhost is supported; normal Pi network use requires HTTPS, or an SSH tunnel for testing. Selected images are copied to the shoe server and included in backups. Live Google sign-in still needs to be tested with your own configured account.

The Pi installer and service need to be checked on your actual Raspberry Pi. Application and access-control tests passed in the development environment.
