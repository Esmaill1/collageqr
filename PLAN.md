# DeskLore — Pilot Implementation Plan

## Product bet

DeskLore is a living guestbook for library desks, unlocked by focus. The
product is about a message passed from one student to the next. A 10-minute
focus session is the effort wall that makes the contribution meaningful.

## Locked pilot decisions

| Decision | Pilot choice |
| --- | --- |
| Primary value | Connection between students |
| Focus duration | 10 minutes, 9:30 server threshold |
| Contribution | Text message, optionally sealed |
| Initial physical pilot | 5–10 desks in one library area |
| Seed content | Deterministic checked-in Arabic-first notes |
| Moderation | Effort wall + three-device reports + admin review |
| Auth | Anonymous server-issued device cookie |
| Stack | Next.js 15, React 19, Prisma, PostgreSQL |
| Deployment | Vercel or Docker |

## Active implementation

### Read-first desk page

- Render desk identity and latest public message before the focus action.
- Show one stable prompt per desk to reduce blank-page friction.
- Keep the older public messages as a lightweight history.
- Surface an unopened sealed-envelope indicator when available.

### Focus ritual

- Centralize the duration in `lib/focus.ts`.
- Keep the client timer, API response, completion threshold, and XP increment
  aligned to the same 10-minute contract.
- Persist paused timer state so a refresh cannot silently consume background
  time.
- Keep the visibility and wake-lock behavior as best-effort client guidance.

### Message contribution

- Reduce the composer to text, optional alias, and optional sealed toggle.
- Reject drawing, music, and pass-doodle fields at the API boundary.
- Enforce 160 normalized characters on the server, not only in the browser.
- Consume the signing token atomically before creating the message.

### Sealed envelope

- Keep secret content out of SSR feed HTML.
- Open atomically for exactly one different device.
- Record the opener device hash.
- Allow only the opener to pin or delete the opened envelope.

### Seed and pilot hardening

- Seed two text rows per desk: one public and one sealed.
- Reconcile only seed-owned rows on rerun; preserve real student content.
- Make `npm test` work without Postgres, Gemini, or third-party providers.
- Pin Node/npm versions and provide a Dockerfile.

## Deferred work

Do not reintroduce these until the core loop has real pilot evidence:

- Pixel doodles
- Music/cassette links
- Pass-the-doodle
- Badge voting
- Leaderboard and competition
- Desk leveling as a visible reward
- AI moderation
- NFC stickers

The existing dormant schema and isolated components may remain to avoid a
destructive rewrite, but the student-facing pilot must not expose them.

## Acceptance gates

### Product gate

- A first-time visitor understands the product from the desk page without
  reading documentation.
- The latest message is the first meaningful content they see.
- A visitor can start, complete, and recover a 10-minute session.
- A completed session publishes exactly one public or sealed text message.
- A different device can open a sealed message and only that opener can decide
  whether to pin or delete it.

### Content gate

- A fresh seed has 30 public and 30 sealed seed messages.
- No seed doodle, cassette, or pass-doodle rows are created.
- A second seed run does not duplicate seed rows or remove user rows.

### Reproducibility gate

```text
npm ci
npm test
npm run build
```

Database setup is separate:

```text
npm run db:migrate
npm run db:seed
```

## Pilot checklist

- [ ] Choose one library area and 5–10 desks.
- [ ] Seed and read every selected desk on a phone.
- [ ] Print and test each QR sticker before placement.
- [ ] Verify a fresh device can open a sealed message.
- [ ] Track session starts, completions, messages, sealed opens, and reports.
- [ ] Review real messages daily during the first pilot week.
- [ ] Interview participants about connection, not feature requests.
