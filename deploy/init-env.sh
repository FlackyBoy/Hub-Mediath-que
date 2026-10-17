#!/usr/bin/env bash
# Crée ~/hub/.env à partir de .env.example avec des secrets générés sur place.
# Ne fait rien si .env existe déjà. Le mot de passe se définit avec set-password.sh.
# Usage : bash deploy/init-env.sh https://hub.xxxx.ts.net
set -euo pipefail
cd "$(dirname "$0")/.."

APP_URL="${1:?Usage : bash deploy/init-env.sh https://hub.xxxx.ts.net}"

if [ -f .env ]; then
  echo ".env existe déjà, rien à faire."
  exit 0
fi

session_secret=$(openssl rand -hex 32)
# Clés VAPID (P-256) générées par Node dans un conteneur jetable
read -r vapid_public vapid_private < <(docker run --rm node:24-alpine node -e '
  const { generateKeyPairSync } = require("crypto");
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pub = publicKey.export({ format: "jwk" }), priv = privateKey.export({ format: "jwk" });
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, "base64url"), Buffer.from(pub.y, "base64url")]);
  console.log(raw.toString("base64url"), priv.d);
')

sed -e "s|^APP_URL=.*|APP_URL=${APP_URL}|" \
    -e "s|^SESSION_SECRET=.*|SESSION_SECRET=${session_secret}|" \
    -e "s|^VAPID_PUBLIC_KEY=.*|VAPID_PUBLIC_KEY=${vapid_public}|" \
    -e "s|^VAPID_PRIVATE_KEY=.*|VAPID_PRIVATE_KEY=${vapid_private}|" \
    -e "s|^PUID=.*|PUID=$(id -u)|" \
    -e "s|^PGID=.*|PGID=$(id -g)|" \
    .env.example > .env
chmod 600 .env
echo ".env créé (mot de passe à définir : bash deploy/set-password.sh)"
