-- SkillLoop schema, v1
-- All timestamps are ISO 8601 strings (UTC).
-- Credit balance is derived from the ledger; there is no balance column on users.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  avatar        TEXT NOT NULL DEFAULT '🌱',
  city          TEXT NOT NULL DEFAULT '',
  headline      TEXT NOT NULL DEFAULT '',
  bio           TEXT NOT NULL DEFAULT '',
  is_demo       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS teach_skills (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  skill      TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT '其他',
  level      TEXT NOT NULL DEFAULT '入门',
  blurb      TEXT NOT NULL DEFAULT '',
  format     TEXT NOT NULL DEFAULT 'both',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_teach_user ON teach_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_teach_skill ON teach_skills(skill);

CREATE TABLE IF NOT EXISTS learn_wants (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  skill      TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT '其他',
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_learn_user ON learn_wants(user_id);

CREATE TABLE IF NOT EXISTS exchanges (
  id                 TEXT PRIMARY KEY,
  requester_id       TEXT NOT NULL,
  partner_id         TEXT NOT NULL,
  teach_skill        TEXT NOT NULL,
  give_skill         TEXT NOT NULL DEFAULT '',
  mode               TEXT NOT NULL DEFAULT 'swap',
  message            TEXT NOT NULL DEFAULT '',
  duration_hours     INTEGER NOT NULL DEFAULT 1,
  proposed_at        TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'pending',
  requester_reviewed INTEGER NOT NULL DEFAULT 0,
  partner_reviewed   INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exchanges_requester ON exchanges(requester_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_partner ON exchanges(partner_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_status ON exchanges(status);

CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY,
  exchange_id TEXT NOT NULL,
  sender_id   TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_exchange ON messages(exchange_id);

CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT PRIMARY KEY,
  exchange_id TEXT NOT NULL,
  author_id   TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  rating      INTEGER NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  UNIQUE (exchange_id, author_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_id);

CREATE TABLE IF NOT EXISTS ledger (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  exchange_id TEXT,
  delta       INTEGER NOT NULL,
  reason      TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id);
