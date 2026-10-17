#!/usr/bin/env bash
# Désinstalle Docker installé par install-docker.sh (conteneurs et images compris).
# Usage : sudo bash deploy/uninstall-docker.sh
set -euo pipefail

systemctl disable --now docker 2>/dev/null || true
rm -f /etc/systemd/system/docker.service
systemctl daemon-reload
rm -f /usr/local/bin/{containerd,containerd-shim-runc-v2,ctr,docker,docker-init,docker-proxy,dockerd,runc}
rm -rf /usr/local/lib/docker /etc/docker
echo "Pour supprimer aussi images et volumes : sudo rm -rf /var/lib/docker /var/lib/containerd"
