-- Searches that found no song: one row per normalized text, no visitor data.
CREATE TABLE IF NOT EXISTS missed_searches (
  query TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS missed_searches_by_count ON missed_searches (count DESC);
