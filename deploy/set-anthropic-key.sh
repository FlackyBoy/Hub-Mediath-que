#!/usr/bin/env bash
# Enregistre la clé API Anthropic dans .env (saisie masquée) puis redémarre l'app.
# Usage : bash deploy/set-anthropic-key.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo ".env absent : lancer d'abord deploy/init-env.sh"; exit 1; }

read -r -s -p "Colle ta clé API Anthropic (sk-ant-...) : " key; echo
key="$(printf '%s' "$key" | tr -d '[:space:]')"
case "$key" in
  sk-ant-*) ;;
  *) echo "Ça ne ressemble pas à une clé Anthropic (elle commence par sk-ant-)."; exit 1 ;;
esac

# Vérifie la clé auprès d'Anthropic avant de l'enregistrer (le format seul ne suffit pas)
status=$(curl -s -o /dev/null -w '%{http_code}' -m 20 -H "x-api-key: ${key}" -H "anthropic-version: 2023-06-01" \
  "https://api.anthropic.com/v1/models?limit=1" || echo "000")
if [ "$status" != "200" ]; then
  echo "Clé refusée par Anthropic (code ${status}). Vérifie-la sur https://console.anthropic.com > API Keys."
  exit 1
fi
echo "Clé valide."

if grep -q '^ANTHROPIC_API_KEY=' .env; then
  sed -i "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=${key}|" .env
else
  printf '\nANTHROPIC_API_KEY=%s\n' "$key" >> .env
fi
unset key
echo "Clé enregistrée."

docker compose up -d --force-recreate app >/dev/null
echo "App redémarrée : le chat est prêt."
