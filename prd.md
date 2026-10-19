# Product Requirements Document: DeskLore

## Product summary

DeskLore is a living guestbook for library desks. A student scans a QR code,
reads a short message from someone who used the desk before, focuses there for
10 minutes, and leaves a message for the next occupant.

The primary product value is **connection between students who share a place**.
The focus session is a small commitment that protects the quality of the
guestbook; it is not the main productivity product.

| Decision | Pilot choice |
| --- | --- |
| Platform | Mobile-first web app |
| Audience | University students using campus library desks |
| Language | Egyptian Arabic, RTL |
| Authentication | Zero-login, anonymous device session |
| Primary loop | Scan → read → focus 10 minutes → leave a message |
| Contribution formats | Text note, optionally sealed for the next person |
| Pilot size | 5–10 desks in one library area |
| Database | PostgreSQL through Prisma |
| Deployment | Vercel or the included Docker image |

## Core user journey

1. A student scans the sticker on Desk B14.
2. The desk page immediately shows the latest message and a short desk prompt.
3. The student can read the older desk history without creating an account.
4. The student starts a 10-minute focus session.
5. Completing the session unlocks one text contribution for that desk.
6. The student writes a message, optionally adds an alias, and optionally seals
   it for the next occupant.
7. The message appears at the top of the desk history, or becomes the next
   sealed envelope to be opened by another device.

## Product requirements

### Desk pages

- `/?desk=<id>` loads one physical desk.
- An unknown desk shows a clear missing-sticker state.
- The latest public message is visually prominent.
- A stable prompt gives the visitor an easy way to decide what to write.
- The page works without login, email, phone number, or profile creation.

### Focus commitment

- A session lasts 10 minutes.
- The server accepts completion after 9 minutes and 30 seconds of elapsed time.
- The client pauses its visible timer when the page is backgrounded for longer
  than the short grace window.
- The server uses a signed session token and a one-time completion update.
- One completed session unlocks one message.
- The focus wall is a best-effort commitment mechanism, not a claim of perfect
  foreground-time verification.

### Messages

- Public messages are plain text up to 160 normalized characters.
- Raw URLs are removed before storage and rendering.
- An optional alias is limited to 40 characters.
- Empty or URL-only messages are rejected.
- A sealed message requires text and is hidden from the public feed until it is
  opened and explicitly pinned.
- A sealed message can be opened once by a different device from its author.
- Only the device that opened it can pin it or keep it secret.

### Trust and moderation

- Every message can be reported by a device.
- Three distinct device reports hide a published message.
- The admin dashboard can restore or delete hidden/flagged messages.
- The pilot uses the focus wall, curated seed content, community reports, and
  manual review. AI moderation is deliberately out of scope.

### Seed content

- The seed command creates desks B01–B30.
- Each desk receives one public text note and one unopened sealed text note.
- Seed content is checked in, deterministic, Arabic-first, and does not call
  Gemini or any external provider.
- Re-running the seed reconciles seed-owned rows without deleting real user
  messages.

## Data model notes

The current schema retains dormant fields and enum values for future artifact
experiments. The pilot application must only create and expose `TEXT` and
`SEALED` capsules. Existing future fields should not be removed destructively
until a later product decision justifies a migration.

## Deferred experiments

The following are intentionally not part of the pilot:

- Pixel drawings
- Music/cassette recommendations
- Pass-the-doodle chains
- Physical badge voting
- Desk leaderboard and public competition
- Desk levels as a primary reward
- Gemini pre-publish moderation
- NFC stickers

Each deferred feature must earn its way back through evidence from the simple
read → focus → message loop.

## Success measures

The primary measure is:

> Completed focus sessions that result in published messages per active desk.

Supporting measures:

- Desk visit → focus-session start
- Session start → completion
- Completion → message publication
- Repeat visits to the same desk
- Sealed-envelope opens
- Report and removal rate

The first pilot should establish a baseline before setting hard targets.
