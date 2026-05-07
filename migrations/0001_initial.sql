CREATE TABLE IF NOT EXISTS aliases (
  address    TEXT PRIMARY KEY,
  status     TEXT NOT NULL DEFAULT 'active',
  first_seen INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL,
  mail_count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aliases_status ON aliases(status);
CREATE INDEX IF NOT EXISTS idx_aliases_last_seen ON aliases(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_aliases_expires_at ON aliases(expires_at);

CREATE TABLE IF NOT EXISTS logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp  INTEGER NOT NULL,
  level      TEXT NOT NULL DEFAULT 'info',
  event      TEXT NOT NULL,
  alias      TEXT,
  from_addr  TEXT,
  to_addr    TEXT,
  message    TEXT,
  details    TEXT
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_event ON logs(event);
