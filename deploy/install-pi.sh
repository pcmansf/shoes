#!/usr/bin/env bash
set -euo pipefail
umask 022

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this installer with: sudo bash deploy/install-pi.sh" >&2
  exit 1
fi
if [ "$(uname -s)" != Linux ] || [ ! -d /run/systemd/system ]; then
  echo "This installer requires Raspberry Pi OS (or Debian/Ubuntu) with systemd." >&2
  exit 1
fi
case "$(uname -m)" in
  aarch64|arm64) arch=arm64 ;;
  x86_64) arch=x64 ;;
  *) echo "Use 64-bit Raspberry Pi OS. This installer does not support a 32-bit OS." >&2; exit 1 ;;
esac
source_root=$(cd -- "$(dirname -- "$0")/.." && pwd)
test -f "$source_root/tests/fixture-collection.mjs" || { echo "Missing test fixture: tests/fixture-collection.mjs" >&2; exit 1; }
for required in server.mjs package.json test.mjs server-test.mjs drive-test.mjs save-test.mjs photo-test.mjs collection-test.mjs locations-test.mjs editor-test.mjs interactions-test.mjs location-icons-test.mjs confirmations-test.mjs storage-test.mjs ui/storage-status.js ui/action-confirmations.js LUCIDE-LICENSE.txt ui/dialog-interactions.js ui/location-icons.js src/locations.js ui/editor-guard.js src/worker.js src/server-access.js src/drive-config.js src/photo-cleanup.js ui/index.html ui/save-pair.js ui/photo-zoom.js ui/seasons.js drizzle/0000_shoe_collection.sql; do
  test -f "$source_root/$required" || { echo "Missing app file: $required" >&2; exit 1; }
done

apt-get update
apt-get install -y ca-certificates curl xz-utils
stage=$(mktemp -d /tmp/shoes-install.XXXXXX)
trap 'rm -rf -- "$stage"' EXIT
node_version=v24.22.0
archive="node-$node_version-linux-$arch.tar.xz"
if [ ! -x /opt/shoes-node/bin/node ] || [ "$(/opt/shoes-node/bin/node --version)" != "$node_version" ]; then
  curl --fail --show-error --silent --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/$node_version/$archive" -o "$stage/$archive"
  curl --fail --show-error --silent --location --proto '=https' --tlsv1.2 "https://nodejs.org/dist/$node_version/SHASUMS256.txt" -o "$stage/SHASUMS256.txt"
  awk -v name="$archive" '$2 == name {print}' "$stage/SHASUMS256.txt" > "$stage/checksum"
  test -s "$stage/checksum"
  (cd "$stage" && sha256sum --check checksum)
  mkdir "$stage/node"
  tar -xJf "$stage/$archive" --strip-components=1 -C "$stage/node"
  "$stage/node/bin/node" --input-type=module -e "import {DatabaseSync} from 'node:sqlite'; new DatabaseSync(':memory:').close()"
  # Stop only this app before replacing its runtime.
  if systemctl is-active --quiet shoes.service; then systemctl stop shoes.service; fi
  install -d -m 755 /opt/shoes-node
  cp -a "$stage/node/." /opt/shoes-node/
fi

if ! id shoes >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/shoes --shell /usr/sbin/nologin shoes
fi
if systemctl is-active --quiet shoes.service; then systemctl stop shoes.service; fi
install -d -m 755 /opt/shoes /opt/shoes/src /opt/shoes/ui /opt/shoes/drizzle /opt/shoes/tests
install -m 644 "$source_root/tests/fixture-collection.mjs" /opt/shoes/tests/
install -m 644 "$source_root/server.mjs" "$source_root/package.json" "$source_root/test.mjs" "$source_root/server-test.mjs" "$source_root/drive-test.mjs" "$source_root/save-test.mjs" "$source_root/photo-test.mjs" "$source_root/collection-test.mjs" "$source_root/locations-test.mjs" "$source_root/editor-test.mjs" "$source_root/interactions-test.mjs" "$source_root/location-icons-test.mjs" "$source_root/confirmations-test.mjs" "$source_root/storage-test.mjs" "$source_root/LUCIDE-LICENSE.txt" /opt/shoes/
install -m 644 "$source_root"/src/*.js /opt/shoes/src/
install -m 644 "$source_root"/ui/* /opt/shoes/ui/
install -m 644 "$source_root"/drizzle/*.sql /opt/shoes/drizzle/
install -d -m 700 -o shoes -g shoes /var/lib/shoes

new_config=false
if [ ! -e /etc/shoes.env ]; then
  short_name=$(hostname -s)
  if [[ ! "$short_name" =~ ^[A-Za-z0-9][A-Za-z0-9-]*$ ]]; then short_name=raspberrypi; fi
  origins="http://$short_name.local:3000,http://$short_name:3000,http://127.0.0.1:3000,http://localhost:3000"
  for address in $(hostname -I); do
    if [[ "$address" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then origins="$origins,http://$address:3000"; fi
  done
  password=$(/opt/shoes-node/bin/node -e "console.log(require('node:crypto').randomBytes(16).toString('hex'))")
  install -m 600 /dev/null /etc/shoes.env
  cat > /etc/shoes.env <<EOF
SHOES_HOST=0.0.0.0
SHOES_PORT=3000
SHOES_DATA_DIR=/var/lib/shoes
SHOES_USERNAME=shoes
SHOES_PASSWORD=$password
SHOES_ORIGINS=$origins
EOF
  new_config=true
fi
chmod 600 /etc/shoes.env
runuser -u shoes -- /opt/shoes-node/bin/node /opt/shoes/test.mjs
runuser -u shoes -- /opt/shoes-node/bin/node /opt/shoes/server-test.mjs
runuser -u shoes -- /opt/shoes-node/bin/node /opt/shoes/drive-test.mjs
runuser -u shoes -- /opt/shoes-node/bin/node /opt/shoes/save-test.mjs
runuser -u shoes -- /opt/shoes-node/bin/node /opt/shoes/photo-test.mjs
runuser -u shoes -- /opt/shoes-node/bin/node /opt/shoes/collection-test.mjs
runuser -u shoes -- /opt/shoes-node/bin/node /opt/shoes/locations-test.mjs
runuser -u shoes -- /opt/shoes-node/bin/node /opt/shoes/editor-test.mjs
runuser -u shoes -- /opt/shoes-node/bin/node /opt/shoes/interactions-test.mjs
runuser -u shoes -- /opt/shoes-node/bin/node /opt/shoes/location-icons-test.mjs
runuser -u shoes -- /opt/shoes-node/bin/node /opt/shoes/confirmations-test.mjs
runuser -u shoes -- /opt/shoes-node/bin/node /opt/shoes/storage-test.mjs
install -m 644 "$source_root/deploy/shoes.service" /etc/systemd/system/shoes.service
systemctl daemon-reload
systemctl enable --now shoes.service
sleep 2
if ! systemctl is-active --quiet shoes.service; then
  journalctl -u shoes.service -n 30 --no-pager
  exit 1
fi
echo
echo "Shoes is installed and will start automatically after reboot."
if [ "$new_config" = true ]; then
  echo "Open http://$short_name.local:3000 from a device on your home network."
  echo "Username: shoes"
  echo "Password: $password"
  echo "Keep this password somewhere safe. It is also in /etc/shoes.env."
else
  echo "Your existing login, network settings and collection were preserved."
  echo "The configured addresses and login are in /etc/shoes.env."
fi
echo "Database and photos: /var/lib/shoes"
