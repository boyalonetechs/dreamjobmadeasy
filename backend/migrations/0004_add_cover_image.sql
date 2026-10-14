-- Add cover image URL to chapters (admin uploads cover art per audio)
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS cover_image_url text;