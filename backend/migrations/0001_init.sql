-- Dream Job Made Easy — initial schema
-- Auth, catalogue, audio URLs and payments all live in Postgres.

-- ---------------------------------------------------------------- auth

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT        NOT NULL,
    email         TEXT        NOT NULL,
    password_hash TEXT        NOT NULL,
    has_access    BOOLEAN     NOT NULL DEFAULT FALSE,
    plan          TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness: login lowercases the address first.
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

-- ---------------------------------------------------------------- catalogue

CREATE TABLE chapters (
    id             TEXT        PRIMARY KEY,
    side           TEXT        NOT NULL,
    no             SMALLINT    NOT NULL,
    title          TEXT        NOT NULL,
    blurb          TEXT        NOT NULL DEFAULT '',
    minutes        INTEGER     NOT NULL DEFAULT 0,
    seconds        INTEGER     NOT NULL DEFAULT 0,
    duration_label TEXT        NOT NULL,
    is_free        BOOLEAN     NOT NULL DEFAULT FALSE,
    sort_order     INTEGER     NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX chapters_sort_order_idx ON chapters (sort_order);

-- ---------------------------------------------------------------- audio urls
-- The single place audio URLs are stored. Point these at S3 / R2 / Neon
-- in production; `storage_provider` and `storage_key` record where from.

CREATE TABLE audio_files (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chapter_id       TEXT        NOT NULL REFERENCES chapters (id) ON DELETE CASCADE,
    kind             TEXT        NOT NULL CHECK (kind IN ('sample', 'full')),
    audio_url        TEXT        NOT NULL,
    storage_provider TEXT,
    storage_key      TEXT,
    byte_size        BIGINT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (chapter_id, kind)
);

CREATE INDEX audio_files_chapter_idx ON audio_files (chapter_id);

-- ---------------------------------------------------------------- payments

CREATE TABLE payments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    provider          TEXT        NOT NULL CHECK (provider IN ('paystack', 'paypal', 'demo')),
    provider_reference TEXT,
    amount_minor      BIGINT      NOT NULL DEFAULT 0,
    currency          TEXT        NOT NULL,
    status            TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    raw               JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- One row per provider transaction: re-verifying the same reference
    -- updates the existing row instead of double-crediting access.
    UNIQUE (provider, provider_reference)
);

CREATE INDEX payments_user_idx ON payments (user_id, created_at DESC);

-- ---------------------------------------------------------------- seed

INSERT INTO chapters (id, side, no, title, blurb, minutes, seconds, duration_label, is_free, sort_order) VALUES
('a1-cv',        'A', 1, 'A CV that gets shortlisted',                  'The one-page Lagos format: what recruiters scan in 7 seconds and what makes them call you.',   24, 10, '24:10', TRUE,  1),
('a2-cover',     'A', 2, 'Cover letters hiring managers read',           'Three paragraphs, zero begging. Templates for fresh graduates and career switchers.',          19, 44, '19:44', FALSE, 2),
('a3-linkedin',  'A', 3, 'LinkedIn that brings offers',                 'Headline, featured section and the weekly routine that got 40+ interviews.',                   27,  2, '27:02', FALSE, 3),
('a4-tests',     'A', 4, 'Aptitude tests without panic',                 'SHL, Dragnet and Workforce patterns with timed drills you can replay.',                         22, 31, '22:31', FALSE, 4),
('b1-interview', 'B', 1, 'The interview room: tell me about yourself',   'A word-for-word answer framework plus 12 follow-up questions and what they really mean.',       31, 15, '31:15', FALSE, 5),
('b2-salary',    'B', 2, 'Salary talk without fear',                    'How to quote in naira and dollars, handle lowball offers and ask for more.',                     26, 48, '26:48', FALSE, 6),
('b3-remote',    'B', 3, 'Remote jobs and dollar pay',                  'Where the listings hide, how to pass async interviews and get paid out.',                        29, 20, '29:20', FALSE, 7),
('b4-offer',     'B', 4, 'Offer letter to first 90 days',               'Reading contracts, probation survival and turning a job into a career ladder.',                 25, 56, '25:56', FALSE, 8);

INSERT INTO audio_files (chapter_id, kind, audio_url, storage_provider) VALUES
('a1-cv',        'sample', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 'demo'),
('a1-cv',        'full',   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 'demo'),
('a2-cover',     'sample', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 'demo'),
('a2-cover',     'full',   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 'demo'),
('a3-linkedin',  'sample', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', 'demo'),
('a3-linkedin',  'full',   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', 'demo'),
('a4-tests',     'sample', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', 'demo'),
('a4-tests',     'full',   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', 'demo'),
('b1-interview', 'sample', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', 'demo'),
('b1-interview', 'full',   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', 'demo'),
('b2-salary',    'sample', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', 'demo'),
('b2-salary',    'full',   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', 'demo'),
('b3-remote',    'sample', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', 'demo'),
('b3-remote',    'full',   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', 'demo'),
('b4-offer',     'sample', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', 'demo'),
('b4-offer',     'full',   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', 'demo');
