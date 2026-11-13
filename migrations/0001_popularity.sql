-- Song popularity for the Songbook's "Most popular" list.
-- score is time-shifted: each event adds points * 2^((now - epoch) / half-life), so ordering by the
-- stored value equals ordering by the decayed score and the index keeps the top-N query cheap.
CREATE TABLE IF NOT EXISTS song_popularity (
  song_id TEXT PRIMARY KEY,
  score REAL NOT NULL,
  -- All-time plays (quick-player plays and lesson opens, deduplicated like the score); never decays.
  plays INTEGER NOT NULL DEFAULT 0
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS song_popularity_by_score ON song_popularity (score DESC);

-- One row per visitor, song and action per UTC day: an action counts once a day per visitor.
-- visitor is a salted hash of the network address that rotates daily; rows older than a day are pruned.
CREATE TABLE IF NOT EXISTS popularity_marks (
  day INTEGER NOT NULL,
  visitor TEXT NOT NULL,
  song_id TEXT NOT NULL,
  action TEXT NOT NULL,
  PRIMARY KEY (day, visitor, song_id, action)
) WITHOUT ROWID;
