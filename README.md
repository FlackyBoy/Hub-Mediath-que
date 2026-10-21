# Hub perso

PWA auto-hébergée qui regroupe :

1. **Médiathèque** : explorateur de fichiers, espace disque, recherche Prowlarr, envoi vers rTorrent, suivi et notifications.
2. **Bibliothèque** : livres et BD, import du tracker Google Sheets, scan ISBN, métadonnées et résumés Open Library / Google Books.
3. **Jeux** : ludothèque de jeux de société, import Google Sheets, images et infos BoardGameGeek (traduites en français), notes, avis et parties jouées.
4. **Chatbot** (optionnel) : questions sur mes données via l'API Claude (tool use), recommandations de livres, films et jeux.

Usage limité à du contenu que j'ai le droit de télécharger.

## Stack

| Couche | Choix |
|---|---|
| App | Next.js (TypeScript), front + API dans un seul conteneur, PWA |
| UI | Tailwind, français, mobile d'abord |
| Base | SQLite intégré à Node (`node:sqlite`, fichier `data/hub.sqlite`), migrations SQL maison |
| Auth | Un seul compte, hash scrypt dans `.env`, cookie de session signé (30 jours) |
| Indexeurs | Prowlarr (Docker) |
| Torrent | rTorrent existant (SCGI `127.0.0.1:41758`), pas de nouveau client |
| Multimédia | Plex existant (métadonnées, jaquettes) |
| Accès | Tailscale + `tailscale serve` (HTTPS), aucun port public |

Détails : [docs/architecture.md](docs/architecture.md).

## Structure

```
.
├── app/                 # Application Next.js 16
│   ├── src/app/         # Pages : login, (app)/accueil, mediatheque, bibliotheque, chat, reglages
│   ├── src/lib/         # Session, mot de passe, base SQLite, migrations, notifications
│   ├── src/proxy.ts     # Redirection vers /login si non connecté
│   └── public/sw.js     # Service worker (PWA, notifications)
├── data/                # Base SQLite, config Prowlarr, imports CSV (non versionné)
├── docs/                # Architecture
├── docker-compose.yml   # Services app + prowlarr
└── .env.example         # Modèle de configuration (copier en .env)
```

## Développement sur le PC

Prérequis : Node.js 24.

```powershell
Copy-Item .env.example .env
cd app
npm install
npm run hash-password -- "ton mot de passe"   # coller la ligne dans ../.env
npm run vapid                                 # coller les 2 clés dans ../.env
npm run dev
```

Puis ouvrir http://localhost:3000. Vérifications : `npm run typecheck`, `npm run lint`, `npm run build`.

## Déploiement sur le serveur

Serveur : OVH Kimsufi, SSH sur le port 4747, code dans `~/hub`. Adresse du Hub : **https://hub.tail675021.ts.net** (réseau Tailscale uniquement).

Installation initiale (déjà faite le 2026-10-17) :

```bash
sudo bash deploy/install-docker.sh       # Docker 29 + Compose, binaires statiques
sudo bash deploy/install-tailscale.sh    # puis ouvrir le lien affiché
bash deploy/init-env.sh https://hub.tail675021.ts.net
bash deploy/set-password.sh
docker compose up -d --build
sudo tailscale serve --bg 3100
```

⚠️ Ne pas lancer `apt-get update` sur ce serveur : il bloque sur d'anciens dépôts Ubuntu 16.04.

### Mettre à jour le code (depuis le PC, PowerShell, à la racine du repo)

```powershell
git archive --format=tar -o $env:TEMP\hub.tar HEAD
scp -P 4747 $env:TEMP\hub.tar viou@37.187.12.102:/tmp/hub.tar
ssh -p 4747 viou@37.187.12.102 "find ~/hub -mindepth 1 -maxdepth 1 ! -name .env ! -name data -exec rm -rf {} + && tar -xf /tmp/hub.tar -C ~/hub && rm /tmp/hub.tar && cd ~/hub && docker compose up -d --build"
```

L'ancien code est effacé avant l'extraction (pour ne pas garder de fichiers supprimés) ; `.env` et `data/` sont conservés.

### Commandes utiles sur le serveur

```bash
cd ~/hub
docker compose ps                  # état des conteneurs
docker compose logs -f app         # logs de l'app
bash deploy/set-password.sh        # changer le mot de passe du Hub
sudo tailscale serve status        # vérifier l'accès HTTPS
```

### Sauvegardes

Chaque nuit vers 4 h, l'app crée `data/backups/hub-AAAA-MM-JJ-HHMM.tar.gz` (copie vérifiée de la base + couvertures) et garde les 10 dernières. Téléchargement et sauvegarde immédiate : **⚙ Réglages > Sauvegardes**.

Restaurer (sur le serveur) :

```bash
cd ~/hub
bash deploy/restore-backup.sh                                       # liste les sauvegardes
bash deploy/restore-backup.sh data/backups/hub-AAAA-MM-JJ-HHMM.tar.gz
```

L'état actuel est d'abord mis de côté dans `data/backups/avant-restauration-<date>/`.

Restaurer une sauvegarde téléchargée sur le PC : l'envoyer d'abord sur le serveur.

```powershell
scp -P 4747 .\hub-AAAA-MM-JJ-HHMM.tar.gz viou@37.187.12.102:hub/data/backups/
```

### Installer sur l'iPhone

Tailscale activé, ouvrir l'adresse dans **Safari**, se connecter, puis **Partager > Sur l'écran d'accueil**. Ouvrir depuis l'icône, puis **Réglages > Activer les notifications**.

## Avancement

- [x] Étape 0 : repo, structure, docker-compose
- [x] Étape 1 : socle (auth, PWA, layout, notifications, SQLite)
- [x] Déploiement : Docker + Tailscale sur le serveur
- [x] Étape 2a : explorateur (aperçu, renommer, supprimer, sélection multiple) et espace disque
- [x] Étape 2b : recherche Prowlarr, choix du dossier, envoi vers rTorrent, suivi et notifications
- [x] Étape 3 : bibliothèque (import CSV, couvertures Open Library, ajout par scan ISBN / recherche / saisie, notes et avis, filtres)
- [x] Étape 5 : Écrans (films et séries TMDB, swipe, notes, synchro Plex)
- [x] Étape 6 : Jeux (import CSV, fiches BoardGameGeek traduites, filtres joueurs / durée, parties, recommandations dans le chat)
- [x] Étape 4 : chat (Claude Opus 5.5, outils en lecture seule sur la bibliothèque, le disque et rTorrent, recommandations)
