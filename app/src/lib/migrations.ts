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
];
