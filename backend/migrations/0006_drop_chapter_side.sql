-- The catalogue is a single flat series now; the A/B "side" grouping is gone.
-- Chapter ids stay free-form text (existing ids are untouched); new ids are
-- generated from the chapter title.

ALTER TABLE chapters DROP COLUMN side;
