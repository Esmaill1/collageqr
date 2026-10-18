# DeskLore — Implementation Plan

> Synthesized from the PRD (`prd.md`) + planning questionnaire.
> Status: Decisions locked. Ready to build.

---

## 1. Locked Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| **Starting point** | Build the app first (interactive prototype) | Core loop must be proven before physical deployment |
| **Frontend** | Next.js (App Router) | SSR for <1.2s load on library Wi-Fi; API routes in one repo |
| **Backend** | Next.js API Routes (Node, same repo) | Single repo, single deploy; TS end-to-end |
| **Database** | Neon (managed Postgres) | Serverless Postgres, JSONB + enums, branching for dev |
| **MVP scope** | All tiers: P0 + P1 + P2 | Full feature set as written in the PRD |
| **AI moderation** | Skipped entirely | Only Layer 1 (effort wall) + Layer 3 (peel-off). No Layer 2. |
| **Hosting** | Vercel (Next.js native) | Zero-config, edge functions, pairs with Neon |
| **Library** | Campus library, ~30 desks | Matches PRD cold-start plan |
| **Stickers** | QR only for MVP | NFC can be layered under vinyl later |
| **Seed capsules** | LLM-generated (2–3 per desk) | ~75 varied seeds for instant first-scan magic |
| **Domain** | `*.vercel.app` subdomain for MVP | Swap to custom domain later via redirect; stickers stay valid |

---

## 2. Tech Stack (Confirmed)

```
Frontend:   Next.js 14+ App Router, React Server Components, Tailwind CSS
Backend:    Next.js Route Handlers (app/api/*)
Database:   Neon Postgres + Prisma ORM
Canvas:     HTML5 <canvas> for 128x64 1-bit pixel art
Auth:       Zero-login — localStorage UUID + hashed device fingerprint
Timer:      Screen Wake Lock API + Page Visibility API
Deploy:     Vercel (preview per branch, prod on main)
```

### Deliberately excluded from MVP
- **Gemini AI gatekeeper (Layer 2)** — spam handling relies on the 20-min effort wall + 3-device peel-off auto-hide only. Flagged as a risk (see §6).
- **NFC sticker encoding** — QR-only batch generator; NTAG213 can be added later.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Vercel (Next.js App Router)                        │
│                                                     │
│  app/                                               │
│   ├─ ?desk=<id>  → Desk page (RSC, SSR)             │
│   ├─ /leaderboard → Top 10 desks this week          │
│   └─ /api                                         │
│       ├─ /desks/[id]        GET desk state + feed   │
│       ├─ /sessions/start    POST → signed JWT       │
│       ├─ /sessions/complete POST → verify ≥19m30s   │
│       ├─ /capsules          POST → create artifact  │
│       ├─ /capsules/[id]/report  POST peel-off       │
│       └─ /leaderboard       GET top 10              │
└─────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  Neon Postgres (Prisma)                             │
│   desks · capsules · focus_sessions · reports       │
└─────────────────────────────────────────────────────┘
```

**Auth model:** No accounts. A `localStorage` UUID + hashed IP/device fingerprint identifies unique devices for peel-off dedup and sealed-envelope claiming. JWT `session_token` binds a focus session to `(desk_id, start_timestamp)` and is verified server-side on capsule submit.

---

## 4. Data Model (Prisma → Neon)

Mirrors the PRD §5.2 schema. Key additions for the chosen scope:

- `capsules.type` enum: `TEXT | DOODLE | CASSETTE | SEALED | PASS_DOODLE`
- `capsules.pass_parent_id` (nullable FK → capsules.id) — for Pass-the-Doodle chains
- `reports` table: `(capsule_id, device_hash, created_at)` — unique on `(capsule_id, device_hash)` so one device = one peel-off vote. Trigger flips `capsules.status` to `hidden` at count ≥ 3.
- `desk_badges` derived from `desks.tag_counts` JSONB (no separate table).

---

## 5. Implementation Roadmap (Waves)

Each wave is independently shippable. Within a wave, subtasks that touch different files run in parallel; sequential where they share files.

### Wave 1 — Scaffold (foundation)
**Files:** `package.json`, `next.config`, `tailwind.config`, `prisma/schema.prisma`, `.env`, `app/layout.tsx`
- Next.js App Router + Tailwind + TypeScript init
- Neon connection + Prisma schema (desks, capsules, focus_sessions, reports)
- Env wiring (`DATABASE_URL`, `JWT_SECRET`)
- Base layout with grid-paper / dark-amber theme tokens
- **Exit gate:** `pnpm dev` boots, Prisma migrates against Neon branch, `/api/health` returns 200

### Wave 2 — Core Read Loop (the "instant gratification" screen)
**Files:** `app/page.tsx` (desk route via `?desk=`), `app/api/desks/[id]/route.ts`, `app/components/DeskHeader.tsx`, `app/components/Corkboard.tsx`
- Dynamic desk resolution from `?desk=<id>`; invalid → redirect to leaderboard
- Desk header: name, level (XP curve from PRD §3.1), total hours, top-3 badges
- Corkboard feed: scrollable timeline of published capsules
- SSR the feed for <1.2s first paint
- **Exit gate:** visiting `/?desk=B14` renders a desk with seeded data

### Wave 3 — Anti-Cheat Focus Timer
**Files:** `app/components/FocusTimer.tsx`, `app/api/sessions/start/route.ts`, `app/api/sessions/complete/route.ts`, `lib/jwt.ts`
- `POST /api/sessions/start` → issues signed JWT with `desk_id` + `start_timestamp`
- Client timer with `visibilitychange` + 10s grace, then pause
- `navigator.wakeLock.request('screen')` with fallback
- `POST /api/sessions/complete` → rejects if `now - start < 19m30s`
- On completion: +20 XP to desk, returns 15-min-valid Signing Token
- **Exit gate:** complete a (test-shortened) session, verify XP increments and token issues

### Wave 4 — Artifact Creation (P0)
**Files:** `app/components/ArtifactComposer.tsx`, `app/components/PixelCanvas.tsx`, `app/api/capsules/route.ts`
- **Text Note:** 160-char input, URLs stripped, optional alias
- **1-Bit Pixel Canvas:** 128x64, 2 brush sizes + eraser, PictoChat aesthetic, store as base64 PNG or raw bitmask <2KB
- Submit consumes Signing Token (single use, 15-min window)
- New capsule pins to top of feed
- **Exit gate:** complete session → draw doodle + write note → see it pinned

### Wave 5 — P1 Features
**Files:** `app/components/CassetteInput.tsx`, `app/components/SealedEnvelope.tsx`, `app/components/BadgePicker.tsx`, `app/leaderboard/page.tsx`, `app/api/leaderboard/route.ts`, `lib/opengraph.ts`
- **Desk Cassette:** parse Spotify/YT Music/SoundCloud/Anghami URLs → OpenGraph metadata → spinning cassette UI
- **Sealed Envelope:** `is_sealed=true` hides from feed; next unique device scan triggers wax-seal modal; open → pin-public or keep-secret-delete
- **Micro-review badges:** badge picker on token unlock; top-3 surface on desk header
- **Leaderboard:** Top 10 desks by focus-minutes this week
- **Exit gate:** each P1 artifact type round-trips end to end

### Wave 6 — P2: Pass-the-Doodle
**Files:** `app/components/PassDoodleCanvas.tsx`, `app/api/capsules/route.ts` (extend), `app/api/capsules/[id]/continue/route.ts`
- Author draws top half; only bottom 10% visible to next occupant
- Next occupant completes bottom half; combined image publishes to feed
- `pass_parent_id` links the chain
- **Exit gate:** two-device pass-the-doodle produces a merged published image

### Wave 7 — Trust Layer (no AI)
**Files:** `app/components/PeelOffButton.tsx`, `app/api/capsules/[id]/report/route.ts`, `app/admin/page.tsx`
- Peel-off: `reports` row unique per device_hash; count ≥ 3 → `status='hidden'`
- Admin dashboard (simple, password-protected route) to review hidden/flagged capsules → keep or delete
- Effort wall is already in place from Wave 3
- **Exit gate:** 3 simulated peel-offs hide a capsule; admin can restore

### Wave 8 — Cold-Start & Stickers
**Files:** `scripts/seed.ts`, `lib/llm-seed.ts`, `app/stickers/page.tsx`, `app/api/stickers/route.ts`
- LLM-generated seed capsules: 2–3 per desk × 30 desks (~75), varied (welcome note, lo-fi playlist, pixel doodle, sealed envelope), flagged `author_alias='DeskLore Seed'`
- QR sticker batch generator: printable sheet of 30 QR codes targeting `https://<subdomain>.vercel.app/?desk=<id>`, matte minimal design per PRD §7
- **Exit gate:** 30 desks pre-seeded; sticker sheet prints cleanly

### Wave 9 — Polish & Deploy
**Files:** `app/globals.css`, `next.config` (image/edge config), `vercel.json`
- Grid-paper daytime + dark-amber evening theme (auto by hour)
- Performance pass: SSR feed, lazy-load canvas composer, doodle payloads <2KB verified
- Lighthouse mobile ≥ 90 on desk page
- Deploy to Vercel prod; smoke-test scan-to-session on real device
- **Exit gate:** live URL loads <1.2s on 4G, full loop works on a phone

---

## 6. Risks & Mitigations

| Risk | Severity | Mitigation |
| --- | --- | --- |
| **Spam/abuse without AI gatekeeper** | High | Effort wall (20 min) blocks 95% of impulsive trolling; peel-off auto-hide at 3 devices; admin dashboard for manual cleanup. Revisit Gemini Layer 2 before scaling beyond one library. |
| **Sealed-envelope race condition** (two devices scan simultaneously) | Medium | DB-level `SELECT FOR UPDATE` on capsule when claiming; `is_opened` atomic flip. |
| **Timer spoofing** | Medium | Server-side `start_timestamp` in signed JWT; reject submissions <19m30s. JWT secret in env, short TTL. |
| **Wake Lock unsupported** (older browsers/iOS) | Low | Graceful fallback: keep timer running, show "keep this tab open" hint. |
| **Sticker URL changes** if custom domain added later | Low | Use a stable path (`/?desk=<id>`); domain swap is a redirect, QRs stay valid. |
| **OpenGraph fetch failures** for music URLs | Low | Fallback: show raw URL + cassette icon if metadata fetch fails or is rate-limited. |
| **Neon cold starts** | Low | Neon free tier auto-suspend; mitigate with a lightweight keep-alive or accept ~300ms first query. |

---

## 7. Cold-Start Launch Checklist

- [ ] 30 desks registered in `desks` table with `zone_name` + correct IDs matching sticker QRs
- [ ] 2–3 LLM-generated seed capsules per desk published
- [ ] At least one sealed-envelope seed per desk for first-scan delight
- [ ] 30 QR stickers printed (matte, 4×4cm, top-right placement)
- [ ] Vercel prod deploy live at `*.vercel.app`
- [ ] Smoke test on real phone: scan → read → 20-min focus → submit → see pinned
- [ ] Admin dashboard accessible with recovery path for hidden capsules

---

## 8. Success Metrics (from PRD §8, to instrument)

Wire these as events/queries during Wave 2 + Wave 9:
- Scan-to-session conversion > 35%
- Session completion rate > 60%
- Unique scans per active desk > 4/day during midterms
- Manual removal rate < 1% (target may slip without AI gatekeeper — monitor closely)

---

## Next Action

Begin **Wave 1 (Scaffold)**: Next.js App Router + Tailwind + Prisma schema against a Neon dev branch. This is the foundation everything else depends on, so it runs alone.
