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

  // 4 : bibliothèque (livres + recherche plein texte sans accents)
  `CREATE TABLE books (
    id          INTEGER PRIMARY KEY,
    title       TEXT NOT NULL,
    author      TEXT NOT NULL DEFAULT '',
    rating      INTEGER CHECK (rating BETWEEN 0 AND 10),
    status      TEXT NOT NULL DEFAULT 'a_lire' CHECK (status IN ('a_lire', 'en_cours', 'lu', 'abandonne')),
    type        TEXT NOT NULL DEFAULT 'roman',
    style       TEXT NOT NULL DEFAULT '',
    summary     TEXT NOT NULL DEFAULT '',
    pros        TEXT NOT NULL DEFAULT '',
    cons        TEXT NOT NULL DEFAULT '',
    notes       TEXT NOT NULL DEFAULT '',
    publisher   TEXT NOT NULL DEFAULT '',
    year        INTEGER,
    pages       INTEGER,
    isbn        TEXT NOT NULL DEFAULT '',
    cover       TEXT NOT NULL DEFAULT 'pending' CHECK (cover IN ('pending', 'ok', 'doubtful', 'missing')),
    meta_source TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX books_author ON books(author);
  CREATE VIRTUAL TABLE books_fts USING fts5(
    title, author, style, publisher,
    content = 'books', content_rowid = 'id', tokenize = 'unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER books_ai AFTER INSERT ON books BEGIN
    INSERT INTO books_fts (rowid, title, author, style, publisher) VALUES (new.id, new.title, new.author, new.style, new.publisher);
  END;
  CREATE TRIGGER books_ad AFTER DELETE ON books BEGIN
    INSERT INTO books_fts (books_fts, rowid, title, author, style, publisher) VALUES ('delete', old.id, old.title, old.author, old.style, old.publisher);
  END;
  CREATE TRIGGER books_au AFTER UPDATE ON books BEGIN
    INSERT INTO books_fts (books_fts, rowid, title, author, style, publisher) VALUES ('delete', old.id, old.title, old.author, old.style, old.publisher);
    INSERT INTO books_fts (rowid, title, author, style, publisher) VALUES (new.id, new.title, new.author, new.style, new.publisher);
  END;`,

  // 5 : conversations du chat (contenu des messages stocké tel que renvoyé par l'API)
  `CREATE TABLE chat_conversations (
    id         INTEGER PRIMARY KEY,
    title      TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE chat_messages (
    id                 INTEGER PRIMARY KEY,
    conversation_id    INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role               TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content            TEXT NOT NULL,
    input_tokens       INTEGER NOT NULL DEFAULT 0,
    output_tokens      INTEGER NOT NULL DEFAULT 0,
    cache_read_tokens  INTEGER NOT NULL DEFAULT 0,
    cache_write_tokens INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX chat_messages_conversation ON chat_messages(conversation_id, id);`,
];
