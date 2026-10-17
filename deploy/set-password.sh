#!/usr/bin/env bash
# Définit le mot de passe du Hub : saisie masquée, hash scrypt écrit dans .env,
# puis redémarrage de l'app. Le mot de passe n'est jamais affiché ni stocké en clair.
# Usage : bash deploy/set-password.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo ".env absent : lancer d'abord deploy/init-env.sh"; exit 1; }

read -r -s -p "Nouveau mot de passe (8 caractères minimum) : " pw1; echo
read -r -s -p "Confirme le mot de passe : " pw2; echo
[ "$pw1" = "$pw2" ] || { echo "Les mots de passe ne correspondent pas."; exit 1; }
[ "${#pw1}" -ge 8 ] || { echo "Trop court (8 caractères minimum)."; exit 1; }

hash=$(printf '%s' "$pw1" | docker run --rm -i node:24-alpine node -e '
  const { randomBytes, scryptSync } = require("crypto");
  let pw = ""; process.stdin.on("data", (c) => (pw += c)).on("end", () => {
    const N = 16384, r = 8, p = 1, salt = randomBytes(16);
    const h = scryptSync(pw, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
    console.log(`scrypt:${N}:${r}:${p}:${salt.toString("base64url")}:${h.toString("base64url")}`);
  });
')
unset pw1 pw2

sed -i "s|^AUTH_PASSWORD_HASH=.*|AUTH_PASSWORD_HASH=${hash}|" .env
echo "Mot de passe enregistré."

if docker compose ps --status running --services 2>/dev/null | grep -qx app; then
  docker compose up -d --force-recreate app >/dev/null
  echo "App redémarrée."
fi
