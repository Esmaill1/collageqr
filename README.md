# DeskLore

The desk time-capsule. Scan a QR sticker on a library desk, read what previous occupants left on its corkboard, complete a 20-minute focus session, then leave a digital artifact for the next person who sits there.

Built with Next.js 15 (App Router), React 19, Tailwind CSS, Prisma on Neon Postgres, deployed on Vercel.

## Setup

1. `npm install`
2. `cp .env.example .env`
3. Fill in `.env`:
   - `DATABASE_URL` — your Neon connection string.
   - `JWT_SECRET` — a long random string (signs focus-session tokens).
   - `ADMIN_TOKEN` — a long random string (the /admin password).
   - `NEXT_PUBLIC_APP_URL` — optional in dev; set it to your real domain in production so sticker QRs point there.
   - `GEMINI_API_KEY` — optional; only used by the seed script.

## Database

1. Create the schema:

   ```
   npx prisma migrate dev --name init
   ```

2. Seed desks B01–B30, each with 3 starter capsules:

   ```
   npx tsx scripts/seed.ts
   ```

   With `GEMINI_API_KEY` set, the seed generates varied notes via gemini-2.5-flash; without it, it draws from a built-in note pool.

## Run

```
npm run dev
```

Open http://localhost:3000/?desk=B14

## Routes

- `/?desk=B14` — a desk's corkboard + focus timer + artifact composer
- `/leaderboard` — top 10 most-active desks this week
- `/stickers` — printable QR sticker sheet generator (enter desk IDs, print at 4×4cm)
- `/admin` — moderation dashboard (password = `ADMIN_TOKEN`) to review hidden/flagged capsules

## How it works

- **The core loop:** scan a desk QR → read its corkboard → survive a 20-minute focus timer with anti-cheat (leaving the tab pauses the timer; abandon it too long and the session has to be restarted) → sign the desk with a text note, pixel doodle, song recommendation, sealed envelope, or a collaborative pass-doodle.
- **Zero login:** sessions are tied to a device fingerprint stored in localStorage. No accounts, no emails — you're just the next occupant at that desk.
- **Trust layers:** the 20-minute effort wall keeps drive-by noise out; a capsule reported from 3 distinct devices peels off and hides itself pending review; the /admin dashboard handles the rest.
- **Desk leveling:** every focused minute earns the desk 1 XP. Desks climb levels and appear on the leaderboard.

## Deploy to Vercel

1. Push the project to a git repo.
2. Import the repo into Vercel.
3. Add all env vars (`DATABASE_URL`, `JWT_SECRET`, `ADMIN_TOKEN`, `NEXT_PUBLIC_APP_URL`, and optionally `GEMINI_API_KEY`) in the Vercel project settings.
4. Make sure the Neon database allows connections from Vercel.
5. Once deployed, run the migration against the production database and seed it:

   ```
   npx prisma migrate deploy
   npx tsx scripts/seed.ts
   ```

   (Run both with the prod `DATABASE_URL` — or fold `prisma migrate deploy` into the build.)
6. Print stickers from `/stickers` and stick them on library desks. That's the deployment complete.

## Project structure

```
app/        Pages, API routes, and client components (corkboard, timer, composer, admin, stickers)
lib/        Shared logic: sticker URL/QR generation, feed queries, OpenGraph scraping, capsule helpers
prisma/     Schema and migrations (desks, capsules, sessions, devices, reports)
scripts/    Seed script (30 desks, LLM-varied or fallback notes)
```
