#!/usr/bin/env bash
# Enregistre la clé API Anthropic dans .env (saisie masquée) puis redémarre l'app.
# Usage : bash deploy/set-anthropic-key.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo ".env absent : lancer d'abord deploy/init-env.sh"; exit 1; }

read -r -s -p "Colle ta clé API Anthropic (sk-ant-api03-...) : " key; echo
case "$key" in
  sk-ant-api*) ;;
  sk-ant-*)
    echo "Ce n'est pas une clé d'API : elle doit commencer par sk-ant-api03-."
    echo "Crée-la sur https://console.anthropic.com > API Keys > Create Key."
    exit 1 ;;
  *) echo "Ça ne ressemble pas à une clé Anthropic (elle commence par sk-ant-api03-)."; exit 1 ;;
esac

if grep -q '^ANTHROPIC_API_KEY=' .env; then
  sed -i "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=${key}|" .env
else
  printf '\nANTHROPIC_API_KEY=%s\n' "$key" >> .env
fi
unset key
echo "Clé enregistrée."

docker compose up -d --force-recreate app >/dev/null
echo "App redémarrée : le chat est prêt."
