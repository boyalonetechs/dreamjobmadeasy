# DreamJobMadeEasy

Audiobook platform. Every tape is locked until the user pays once (₦ via Paystack, $ via PayPal), then streams the full 8-chapter book in the browser. There is no free preview.

```
dreamjobmadeeasy/
  frontend/  Next.js 14 (landing, login, signup, pricing, dashboard, success)
  backend/   Actix Web 4 (auth + JWT, gated audio, Paystack + PayPal verify)
  backend/migrations/  Postgres schema (users, chapters, audio_files, payments)
```

## Design

Dossier-paper identity: warm paper `#FFFDFA`, plum ink `#1E1A2E`, ballpoint cobalt `#2B3BEB`, offer-stamp marigold `#EAA200`, hired red `#C93A26` sparingly. Display in Bricolage Grotesque, body in Instrument Sans, tape counters only in Space Mono. Hero opens with a working tape player, not stats. Chapters are ledger rows (Side A1/B2), not cards. One orchestrated motion: stamp-in + reels spin while playing.

## Run locally

### 1. Backend (Rust)

```bash
cp backend/.env.example backend/.env
# set DATABASE_URL to your Neon/Postgres connection string
# fill PAYSTACK_SECRET_KEY + PAYPAL_CLIENT_ID/SECRET for live money,
# or leave empty for demo/mock mode
cargo run --manifest-path backend/Cargo.toml
# API on http://localhost:8080, health: GET /api/health
```

Migrations in `backend/migrations/` run automatically at boot via `sqlx::migrate!`.

API:

- `POST /api/auth/signup` `{name,email,password}` → `{token,user}`
- `POST /api/auth/login` `{email,password}` → `{token,user}`
- `GET /api/auth/me` (Bearer)
- `GET /api/book` → chapters with `locked` + `audio_url` only when unlocked
- `GET /api/audio/:id` → 402 if unpaid, 401 if anonymous
- `POST /api/payments/paystack/initialize` `{email}` (Bearer)
- `GET /api/payments/paystack/verify/:reference` (Bearer, unlocks)
- `POST /api/payments/paypal/create-order` (Bearer)
- `POST /api/payments/paypal/capture` `{order_id}` (Bearer, unlocks)
- `POST /api/dev/unlock` (Bearer, demo without money)

Swap the SoundHelix placeholders in the `audio_files` seed for private S3/R2 URLs with signed URLs + `Range` streaming.

## Database

Postgres (Neon) holds everything; the server is stateless. Schema in `backend/migrations/0001_init.sql`:

| Table         | Holds                                                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `users`       | auth — `email` (unique, case-insensitive), bcrypt `password_hash`, `has_access`, `plan`                                             |
| `chapters`    | catalogue metadata — title, side/no, duration, `is_free`                                                                            |
| `audio_files` | **the audio URLs** — one `sample` and one `full` row per chapter, plus `storage_provider` / `storage_key` / `byte_size`             |
| `payments`    | one row per provider transaction, `UNIQUE (provider, provider_reference)` so a re-verify upserts instead of double-crediting access |

To repoint audio at real hosting, update the rows rather than the code:

```sql
UPDATE audio_files SET audio_url = 'https://cdn.example.com/a1-cv.mp3',
                      storage_provider = 'r2', storage_key = 'a1-cv.mp3'
WHERE chapter_id = 'a1-cv' AND kind = 'full';
```

### 2. Frontend (Next.js)

```bash
cp frontend/.env.example frontend/.env.local
npm --prefix frontend install
npm --prefix frontend run dev
# web on http://localhost:3000
```

Flow: `/` (browse) → `/signup` → `/pricing` (Paystack inline or PayPal redirect, plus demo unlock) → `/success` (verify + unlock) → `/dashboard` (gated `<audio controlsList="nodownload">`).

## Access model

Nothing plays without payment. `chapters.is_free` is retained for future promo
use but no chapter is currently flagged, and `GET /api/book` withholds _both_
`audio_url` and `sample_url` until the account is paid for. Re-gating a chapter
after a refund is `UPDATE users SET has_access = FALSE` or flipping a single
`chapters.is_free` row in a migration.

## Payments wiring

- Paystack: set `PAYSTACK_SECRET_KEY` (backend) + `NEXT_PUBLIC_PAYSTACK_KEY` (frontend). Amount `PRICE_NGN_KOBO=850000` (₦15,000). Verify via `GET https://api.paystack.co/transaction/verify/:reference`.
- PayPal: set `PAYPAL_CLIENT_ID/SECRET/BASE_URL` (backend) + `NEXT_PUBLIC_PAYPAL_CLIENT_ID`. Amount `PRICE_USD=19.00`. Create `v2/checkout/orders`, capture on return, unlock on `COMPLETED`.
- Without keys both providers run in mock mode (`DJME-*` / `MOCK-*`) so the full unlock flow can be demoed.

## Production checklist

- Rotate `DATABASE_URL` credentials; keep `.env` out of git (already ignored) and use a least-privilege DB role.
- Refresh tokens, rate limits, webhooks (`paystack` signature + `paypal` webhook-id) instead of front-channel verify alone.
- Signed, expiring audio URLs, no direct mp3 links, `Content-Disposition: inline`, block download.
- `FRONTEND_URL` + CORS allowlist, HTTPS, `JWT_SECRET` rotation.
# dreamjobmadeasy
