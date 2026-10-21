# Architecture

## Serveur

OVH Kimsufi KS-7 (i3-2130, 8 Go, 2 To), Ubuntu 16.04, partagé avec une seedbox existante. **Rien d'existant n'est modifié ni réinstallé.**

Déjà en place (ne pas toucher) : rTorrent + ruTorrent (Apache/PHP), Transmission, Plex, autodl-irssi, vsftpd, fail2ban.

Ports déjà pris : 80, 443, 4747 (SSH), 9091, 32400, 31400, 51413, 5757, 4224, 42717.

Ports du Hub, tous sur `127.0.0.1` :

| Port | Service |
|---|---|
| 3100 | hub-app |
| 9696 | hub-prowlarr |

## Schéma

```
iPhone / PC ──Tailscale (HTTPS)──> tailscale serve :443 ──> 127.0.0.1:3100  hub-app
                                                                 │
                         ┌───────────────────────────────────────┼─────────────────────┐
                         ▼                     ▼                 ▼                     ▼
                 127.0.0.1:9696        127.0.0.1:41758     127.0.0.1:32400     /home/viou (fichiers)
                 Prowlarr (Docker)     rTorrent (SCGI)     Plex                data/hub.sqlite
```

L'app tourne en `network_mode: host` pour joindre rTorrent et Plex, qui n'écoutent qu'en local. Elle-même n'écoute que sur `127.0.0.1`, donc rien n'est exposé sur l'IP publique.

## Base de données : SQLite

- Un seul utilisateur, quelques milliers de lignes : un serveur Postgres n'apporterait rien et consommerait de la RAM.
- Sauvegarde = copier `data/hub.sqlite`.
- Recherche plein texte native (FTS5) pour la bibliothèque.
- Module `node:sqlite` intégré à Node 24 : aucun module natif à compiler (ni sur Windows, ni dans Docker).
- Migrations : tableau SQL dans `app/src/lib/migrations.ts`, version suivie par `PRAGMA user_version`, appliquées au démarrage.

## Authentification

- Un seul compte : `AUTH_USERNAME` + `AUTH_PASSWORD_HASH` (scrypt) dans `.env`.
- Cookie `hub_session` signé HMAC (`SESSION_SECRET`), `HttpOnly`, `Secure` en production, 30 jours.
- `src/proxy.ts` redirige vers `/login` ; chaque page et Server Action revérifie la session (`requireSession`).
- 5 échecs de connexion consécutifs bloquent 15 minutes.
- Changer `SESSION_SECRET` déconnecte tous les appareils.

## PWA et notifications

- `src/app/manifest.ts` + icônes dans `public/icons/` et `src/app/apple-icon.png`.
- `public/sw.js` : notifications push et ouverture de l'app au clic.
- Abonnements stockés dans la table `push_subscriptions` ; `sendPushToAll()` dans `src/lib/push.ts`.
- Sur iPhone : iOS 16.4 minimum, app installée sur l'écran d'accueil, HTTPS (fourni par `tailscale serve`).

## Modules

| Module | Sources |
|---|---|
| Médiathèque | Système de fichiers (`MEDIA_DIRS`), Prowlarr API, rTorrent XML-RPC sur SCGI, Plex API |
| Bibliothèque | SQLite, import CSV, Open Library puis Google Books, `BarcodeDetector` / zxing |
| Jeux | SQLite, import CSV, BoardGameGeek XML API2 (jeton `BGG_API_TOKEN`), traduction des fiches par l'API Claude |
| Chatbot | API Claude, outils en lecture seule sur SQLite et le disque |

## Installation serveur

Ubuntu 16.04 n'est plus supporté par les paquets Docker récents (`xenial` plafonne à 20.10.7, incompatible seccomp avec les images récentes). Choix retenu :

- **Docker 29.9.1** en binaires statiques officiels dans `/usr/local/bin`, service `docker.service` dédié, Compose v5.6.0 en plugin. Sans apt, désinstallable avec `deploy/uninstall-docker.sh`. Build via le builder classique (pas de buildx).
- **Tailscale 1.104.1** (paquet .deb, dépôt apt retiré après installation), lancé avec `--accept-dns=false` pour ne pas toucher au DNS du serveur (bind9 local).
- `tailscale serve --bg 3100` publie l'app en HTTPS (certificat Tailscale) sur `https://hub.tail675021.ts.net`, réseau Tailscale uniquement.
- `apt-get update` bloque sur ce serveur (anciens dépôts) : ne pas l'utiliser.

L'image de l'app est basée sur Alpine (musl).
