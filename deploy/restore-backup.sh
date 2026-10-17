#!/usr/bin/env bash
# Restaure une sauvegarde du Hub (base + couvertures). L'état actuel est d'abord mis de côté
# dans data/backups/avant-restauration-<date>/, pour pouvoir revenir en arrière.
# Usage : bash deploy/restore-backup.sh data/backups/hub-AAAA-MM-JJ-HHMM.tar.gz
set -euo pipefail
cd "$(dirname "$0")/.."

archive="${1:-}"
if [ -z "$archive" ]; then
  echo "Usage : bash deploy/restore-backup.sh data/backups/hub-AAAA-MM-JJ-HHMM.tar.gz"
  echo "Sauvegardes disponibles :"
  ls -1t data/backups/hub-*.tar.gz 2>/dev/null | head -10 || echo "  (aucune)"
  exit 1
fi
[ -f "$archive" ] || { echo "Fichier introuvable : $archive"; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
tar -xzf "$archive" -C "$tmp"
[ -f "$tmp/hub.sqlite" ] || { echo "Archive invalide : hub.sqlite absent."; exit 1; }
echo "Archive valide : base + $(ls "$tmp/covers" 2>/dev/null | wc -l) couverture(s)."

read -r -p "Remplacer les données actuelles par cette sauvegarde ? [o/N] " answer
[[ "$answer" =~ ^[oO] ]] || { echo "Annulé."; exit 0; }

docker compose stop app >/dev/null
keep="data/backups/avant-restauration-$(date +%Y-%m-%d-%H%M%S)"
mkdir -p "$keep"
for f in data/hub.sqlite data/hub.sqlite-wal data/hub.sqlite-shm; do [ -f "$f" ] && mv "$f" "$keep/"; done
[ -d data/covers ] && mv data/covers "$keep/covers"
echo "État actuel mis de côté dans $keep"

cp "$tmp/hub.sqlite" data/hub.sqlite
if [ -d "$tmp/covers" ]; then cp -a "$tmp/covers" data/covers; else mkdir -p data/covers; fi
docker compose start app >/dev/null
echo "Restauration terminée, app redémarrée."
