#!/usr/bin/env bash
# Enregistre le jeton BoardGameGeek dans .env (saisie masquée, vérifiée auprès de BGG) puis redémarre l'app.
# Jeton : boardgamegeek.com/applications > créer une application (usage non commercial) > une fois validée, « Tokens ».
# Usage : bash deploy/set-bgg-token.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo ".env absent : lancer d'abord deploy/init-env.sh"; exit 1; }

read -r -s -p "Colle ton jeton BoardGameGeek : " token; echo
token="$(printf '%s' "$token" | tr -d '[:space:]')"
[ -n "$token" ] || { echo "Jeton vide."; exit 1; }

status=$(curl -s -o /dev/null -w '%{http_code}' -m 20 -H "Authorization: Bearer ${token}" "https://boardgamegeek.com/xmlapi2/thing?id=13" || echo 000)
[ "$status" = "200" ] || { echo "Jeton refusé par BoardGameGeek (code ${status})."; exit 1; }
echo "Jeton valide."

if grep -q '^BGG_API_TOKEN=' .env; then
  sed -i "s|^BGG_API_TOKEN=.*|BGG_API_TOKEN=${token}|" .env
else
  printf '\nBGG_API_TOKEN=%s\n' "$token" >> .env
fi
unset token
docker compose up -d --force-recreate app >/dev/null
echo "App redémarrée : les images et infos des jeux arrivent dans l'onglet Jeux."
