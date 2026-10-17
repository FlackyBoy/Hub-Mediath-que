#!/usr/bin/env bash
# Enregistre la clé TMDB dans .env (saisie masquée, vérifiée auprès de TMDB) puis redémarre l'app.
# Accepte la « clé d'API » (v3) ou le « jeton d'accès en lecture » (v4, commence par eyJ).
# Usage : bash deploy/set-tmdb-key.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo ".env absent : lancer d'abord deploy/init-env.sh"; exit 1; }

read -r -s -p "Colle ta clé TMDB : " key; echo
key="$(printf '%s' "$key" | tr -d '[:space:]')"
[ -n "$key" ] || { echo "Clé vide."; exit 1; }

if [[ "$key" == eyJ* ]]; then
  status=$(curl -s -o /dev/null -w '%{http_code}' -m 20 -H "Authorization: Bearer ${key}" "https://api.themoviedb.org/3/configuration" || echo 000)
else
  status=$(curl -s -o /dev/null -w '%{http_code}' -m 20 "https://api.themoviedb.org/3/configuration?api_key=${key}" || echo 000)
fi
[ "$status" = "200" ] || { echo "Clé refusée par TMDB (code ${status})."; exit 1; }
echo "Clé valide."

if grep -q '^TMDB_API_KEY=' .env; then
  sed -i "s|^TMDB_API_KEY=.*|TMDB_API_KEY=${key}|" .env
else
  printf '\nTMDB_API_KEY=%s\n' "$key" >> .env
fi
unset key
docker compose up -d --force-recreate app >/dev/null
echo "App redémarrée : Écrans et Swipe sont prêts."
