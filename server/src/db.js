const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, 'void_station.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL DEFAULT 'Untitled',
    bpm         INTEGER NOT NULL DEFAULT 120,
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS project_versions (
    id          TEXT PRIMARY KEY,
    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    state_json  TEXT NOT NULL,
    label       TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS audio_files (
    id          TEXT PRIMARY KEY,
    owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
    filename    TEXT NOT NULL,
    original_name TEXT NOT NULL,
    size        INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS collab_sessions (
    code        TEXT PRIMARY KEY,
    project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
    host_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at  INTEGER NOT NULL
  );
`);

module.exports = db;
