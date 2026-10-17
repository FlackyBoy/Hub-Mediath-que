import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrations } from "./migrations";

// SQLite intégré à Node (pas de module natif à compiler).
// Une seule connexion, réutilisée entre les rechargements en dev.

const globalForDb = globalThis as unknown as { hubDb?: DatabaseSync };

function databasePath(): string {
  return process.env.DATABASE_PATH ?? path.resolve(process.cwd(), "..", "data", "hub.sqlite");
}

function migrate(db: DatabaseSync) {
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  for (let version = user_version; version < migrations.length; version++) {
    db.exec("BEGIN");
    try {
      db.exec(migrations[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}

function open(): DatabaseSync {
  const file = databasePath();
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

export function getDb(): DatabaseSync {
  return (globalForDb.hubDb ??= open());
}
