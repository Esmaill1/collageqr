# DeskLore

The desk time-capsule. Scan a QR sticker on a library desk, read what the previous occupant left, focus for 10 minutes, then leave a short message for the next person who sits there.

Built with Next.js 15 (App Router), React 19, Tailwind CSS, Prisma on Neon Postgres, deployed on Vercel.

## Setup

1. Use Node `24.21.0` (the version in `.nvmrc`).
2. `npm ci`
3. `cp .env.example .env`
4. Fill in `.env`:
   - `DATABASE_URL` — your Neon connection string.
   - `JWT_SECRET` — a long random string (signs focus-session tokens).
   - `ADMIN_TOKEN` — a long random string (the /admin password).
   - `NEXT_PUBLIC_APP_URL` — use `http://localhost:3000` for local sticker previews; set the real domain in production.

## Database

1. Apply the committed migrations:

   ```
   npm run db:migrate
   ```

2. Seed desks B01–B30 with one public message and one sealed message each:

   ```
   npm run db:seed
   ```

   The seed is deterministic and local. It does not call Gemini or any external service.

## Run

```
npm run dev
```

Open http://localhost:3000/?desk=B14

## Checks

The offline project check is:

```
npm test
```

It generates the Prisma client, runs the TypeScript check, and runs the pure
unit tests without needing Postgres, Gemini, or third-party music providers.

For the production compilation check:

```
npm run build
```

The build does not run database migrations. Apply migrations separately with
`npm run db:migrate`.

## Docker

Build and run the production container with the same pinned Node runtime:

```
docker build -t desklore .
docker run --env-file .env -p 3000:3000 desklore
```

## Routes

- `/?desk=B14` — read the desk's latest message, focus, and leave a text note
- `/stickers` — printable QR sticker sheet generator (enter desk IDs, print at 4×4cm)
- `/admin` — moderation dashboard (password = `ADMIN_TOKEN`) to review hidden/flagged capsules

Drawing, music, badges, leaderboard, and pass-the-doodle routes remain dormant
for later experiments and are not part of the pilot flow.

## How it works

- **The core loop:** scan a desk QR → read what the previous occupant left → focus for 10 minutes → leave one text message for the next occupant, optionally sealed for them.
- **Zero login:** sessions are tied to a server-issued anonymous device cookie. No accounts, no emails — you're just the next occupant at that desk.
- **Trust layers:** the short focus commitment discourages drive-by noise; a capsule reported from 3 distinct devices peels off and hides itself pending review; the /admin dashboard handles the rest.
- **Shared history:** each completed session adds another message to the desk's story. Desk focus totals remain available for future experiments but are not the pilot's primary reward.

## Deploy to Vercel

1. Push the project to a git repo.
2. Import the repo into Vercel.
3. Add all env vars (`DATABASE_URL`, `JWT_SECRET`, `ADMIN_TOKEN`, and `NEXT_PUBLIC_APP_URL`) in the Vercel project settings.
4. Make sure the Neon database allows connections from Vercel.
5. Once deployed, run the migration against the production database and seed it:

   ```
   npm run db:migrate
   npm run db:seed
   ```

   Run both with the production `DATABASE_URL` before opening the pilot.
6. Print stickers from `/stickers` and stick them on library desks. That's the deployment complete.

## Project structure

```
app/        Pages, API routes, and client components (corkboard, timer, composer, admin, stickers)
lib/        Shared logic: focus contract, desk prompts, sticker URLs, feed queries, capsule helpers
prisma/     Schema and migrations (desks, capsules, sessions, devices, reports)
scripts/    Deterministic seed script (30 desks, text and sealed notes)
```
