#!/usr/bin/env bash
# Installe Tailscale (binaires statiques officiels) sans apt : le apt-get update
# de ce serveur Ubuntu 16.04 bloque sur d'anciens dépôts.
# Usage : sudo bash deploy/install-tailscale.sh
set -euo pipefail

TS_VERSION="1.104.1"

if ! command -v tailscaled >/dev/null 2>&1; then
  tmp=$(mktemp -d)
  file="tailscale_${TS_VERSION}_amd64.tgz"
  curl -fsSL "https://pkgs.tailscale.com/stable/${file}" -o "$tmp/$file"
  expected=$(curl -fsSL "https://pkgs.tailscale.com/stable/${file}.sha256")
  echo "${expected}  $tmp/$file" | sha256sum -c -
  tar -xzf "$tmp/$file" -C "$tmp"
  install -m 0755 "$tmp/tailscale_${TS_VERSION}_amd64/tailscale" /usr/local/bin/tailscale
  install -m 0755 "$tmp/tailscale_${TS_VERSION}_amd64/tailscaled" /usr/local/sbin/tailscaled
  rm -rf "$tmp"
fi

# Service systemd uniquement pour l'installation statique (le paquet .deb fournit le sien)
if [ -x /usr/local/sbin/tailscaled ] && [ ! -f /lib/systemd/system/tailscaled.service ]; then
mkdir -p /var/lib/tailscale
cat > /etc/systemd/system/tailscaled.service <<'EOF'
[Unit]
Description=Tailscale
Wants=network-pre.target
After=network-pre.target

[Service]
Type=notify
ExecStart=/usr/local/sbin/tailscaled --state=/var/lib/tailscale/tailscaled.state --socket=/run/tailscale/tailscaled.sock --port=41641
ExecStopPost=/usr/local/sbin/tailscaled --cleanup
RuntimeDirectory=tailscale
RuntimeDirectoryMode=0755
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
fi

systemctl daemon-reload
systemctl enable tailscaled
systemctl restart tailscaled
sleep 3
tailscale version | head -1

# --accept-dns=false : ne pas toucher au DNS du serveur (bind9 local)
tailscale up --accept-dns=false --hostname=hub --timeout=15s 2>&1 || true
tailscale status 2>&1 | head -5
