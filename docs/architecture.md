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
- Accès via Drizzle ORM : migration vers Postgres possible plus tard sans réécrire les requêtes.

## Modules

| Module | Sources |
|---|---|
| Médiathèque | Système de fichiers (`MEDIA_DIRS`), Prowlarr API, rTorrent XML-RPC sur SCGI, Plex API |
| Bibliothèque | SQLite, import CSV, Open Library puis Google Books, `BarcodeDetector` / zxing |
| Chatbot | API Claude, outils en lecture seule sur SQLite et le disque |

## Installation serveur

Ubuntu 16.04 n'est plus supporté par les versions récentes de Docker : on installe la dernière version publiée pour 16.04 (`xenial`), plus le plugin Compose v2. Les commandes exactes seront fournies et validées au moment du déploiement.
