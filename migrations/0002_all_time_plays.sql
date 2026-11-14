-- The ranking is all-time plays: no decaying score, no seed, no per-visitor deduplication.
-- Apply right before deploying the code that stops using them; plays and song_id are untouched.
DROP INDEX IF EXISTS song_popularity_by_score;
ALTER TABLE song_popularity DROP COLUMN score;
CREATE INDEX IF NOT EXISTS song_popularity_by_plays ON song_popularity (plays DESC, song_id);
DROP TABLE IF EXISTS popularity_marks;
