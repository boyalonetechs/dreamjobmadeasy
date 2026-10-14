-- Remove the demo catalogue that 0001_init.sql seeded.
-- The product now starts empty; real chapters and audio are added through the
-- admin dashboard. Deleting the chapters cascades to their audio_files rows.

DELETE FROM chapters
WHERE id IN (
    'a1-cv', 'a2-cover', 'a3-linkedin', 'a4-tests',
    'b1-interview', 'b2-salary', 'b3-remote', 'b4-offer'
);
