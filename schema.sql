CREATE TABLE IF NOT EXISTS aliases (
  address    TEXT PRIMARY KEY,
  status     TEXT NOT NULL DEFAULT 'active',
  first_seen INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL,
  mail_count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_aliases_status ON aliases(status);
CREATE INDEX IF NOT EXISTS idx_aliases_last_seen ON aliases(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_aliases_expires_at ON aliases(expires_at);
