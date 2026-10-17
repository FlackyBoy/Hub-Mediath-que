// Une entrée par version du schéma, appliquées dans l'ordre (PRAGMA user_version).
// Ne jamais modifier une migration déjà déployée : en ajouter une nouvelle à la fin.

export const migrations: string[] = [
  // 1 : abonnements aux notifications push
  `CREATE TABLE push_subscriptions (
    endpoint   TEXT PRIMARY KEY,
    p256dh     TEXT NOT NULL,
    auth       TEXT NOT NULL,
    user_agent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`,

  // 2 : analyse de l'espace disque
  `CREATE TABLE disk_scan (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    status      TEXT NOT NULL,
    started_at  TEXT,
    finished_at TEXT,
    error       TEXT,
    files       INTEGER,
    size        INTEGER
  );
  CREATE TABLE dir_sizes (
    rel   TEXT PRIMARY KEY,
    size  INTEGER NOT NULL,
    files INTEGER NOT NULL
  );
  CREATE TABLE disk_types (
    kind  TEXT PRIMARY KEY,
    size  INTEGER NOT NULL,
    files INTEGER NOT NULL
  );
  CREATE TABLE disk_files_top (
    rel   TEXT PRIMARY KEY,
    size  INTEGER NOT NULL,
    mtime INTEGER NOT NULL,
    kind  TEXT NOT NULL
  );`,

  // 3 : réglages et téléchargements lancés depuis le Hub
  `CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE downloads (
    hash         TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    category     TEXT NOT NULL,
    dest         TEXT NOT NULL,
    added_at     TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    notified     INTEGER NOT NULL DEFAULT 0
  );`,
];
