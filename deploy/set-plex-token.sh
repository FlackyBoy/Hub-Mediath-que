#!/usr/bin/env bash
# Enregistre le jeton Plex dans .env (lu dans la configuration de Plex, ou saisi), le vérifie,
# puis redémarre l'app. Le Hub ne s'en sert qu'en lecture (bibliothèques et statut « vu »).
# Usage : bash deploy/set-plex-token.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo ".env absent : lancer d'abord deploy/init-env.sh"; exit 1; }

PREFS="/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Preferences.xml"
token=""
if sudo test -f "$PREFS"; then
  read -r -p "Lire le jeton automatiquement dans la configuration de Plex ? [O/n] " answer
  if [[ ! "$answer" =~ ^[nN] ]]; then
    token="$(sudo grep -o 'PlexOnlineToken="[^"]*"' "$PREFS" | sed 's/PlexOnlineToken="//; s/"$//')"
    [ -n "$token" ] && echo "Jeton trouvé." || echo "Jeton introuvable dans la configuration."
  fi
fi
if [ -z "$token" ]; then
  read -r -s -p "Colle ton jeton Plex (X-Plex-Token) : " token; echo
  token="$(printf '%s' "$token" | tr -d '[:space:]')"
fi
[ -n "$token" ] || { echo "Jeton vide."; exit 1; }

status=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "http://127.0.0.1:32400/library/sections?X-Plex-Token=${token}" || echo 000)
[ "$status" = "200" ] || { echo "Jeton refusé par Plex (code ${status})."; exit 1; }
echo "Jeton valide."

if grep -q '^PLEX_TOKEN=' .env; then
  sed -i "s|^PLEX_TOKEN=.*|PLEX_TOKEN=${token}|" .env
else
  printf '\nPLEX_TOKEN=%s\n' "$token" >> .env
fi
unset token
docker compose up -d --force-recreate app >/dev/null
echo "App redémarrée : première synchronisation Plex dans une minute (ou Réglages > Plex > Synchroniser)."
