#!/usr/bin/env bash
# Installe Docker (binaires statiques officiels) + Docker Compose sur Ubuntu 16.04.
# N'utilise pas apt : tout va dans /usr/local, désinstallable avec uninstall-docker.sh.
# Usage : sudo bash deploy/install-docker.sh
set -euo pipefail

DOCKER_VERSION="29.9.1"
COMPOSE_VERSION="v5.6.0"
USER_NAME="${SUDO_USER:-viou}"

if command -v dockerd >/dev/null 2>&1; then
  echo "Docker déjà installé : $(dockerd --version)"
else
  tmp=$(mktemp -d)
  echo "Téléchargement de Docker ${DOCKER_VERSION}..."
  curl -fsSL "https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKER_VERSION}.tgz" -o "$tmp/docker.tgz"
  tar -xzf "$tmp/docker.tgz" -C "$tmp"
  install -m 0755 "$tmp"/docker/* /usr/local/bin/
  rm -rf "$tmp"
fi

echo "Installation de Docker Compose ${COMPOSE_VERSION}..."
mkdir -p /usr/local/lib/docker/cli-plugins
base="https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}"
curl -fsSL "$base/docker-compose-linux-x86_64" -o /tmp/docker-compose
expected=$(curl -fsSL "$base/docker-compose-linux-x86_64.sha256" | awk '{print $1}')
echo "$expected  /tmp/docker-compose" | sha256sum -c -
install -m 0755 /tmp/docker-compose /usr/local/lib/docker/cli-plugins/docker-compose
rm -f /tmp/docker-compose

getent group docker >/dev/null || groupadd docker
usermod -aG docker "$USER_NAME"

mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
EOF

# dockerd lance lui-même son containerd embarqué
cat > /etc/systemd/system/docker.service <<'EOF'
[Unit]
Description=Docker
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
ExecStart=/usr/local/bin/dockerd --group docker
ExecReload=/bin/kill -s HUP $MAINPID
Restart=always
RestartSec=5
LimitNOFILE=1048576
TasksMax=infinity
Delegate=yes
KillMode=process

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable docker
systemctl restart docker

for i in $(seq 1 20); do docker info >/dev/null 2>&1 && break; sleep 1; done
docker version --format 'Docker {{.Server.Version}}'
docker compose version
echo "Installation terminée."
