# Product Requirements Document (PRD): DeskLore (The Desk Time-Capsule)

| Document Details | Specifications |
| --- | --- |
| **Product Name** | DeskLore (Working Title) |
| **Platform** | Mobile-First Progressive Web App (PWA) |
| **Target Users** | University students across all majors utilizing campus library desks |
| **Auth Model** | Zero-Login (Anonymous, session-based via `localStorage` + device fingerprint) |
| **Core Loop** | Scan Desk QR/NFC $\rightarrow$ Browse Desk History $\rightarrow$ Complete 20-Min Focus Timer $\rightarrow$ Leave a Digital Artifact |

---

## 1. Product Overview & Objective

**DeskLore** transforms static library desks into living, location-bound digital time capsules. By scanning a QR code or tapping an NFC sticker attached to a specific library desk, a student opens a digital corkboard exclusive to that exact physical chair.

Anyone sitting at the desk can immediately read notes, view pixel-art doodles, and listen to song recommendations left by previous occupants. However, **to leave a mark of their own, the student must complete a 20-minute distraction-free focus session**. This effort-wall simultaneously gamifies focus, builds campus-wide camaraderie across all academic majors, and eliminates low-effort spam without requiring user accounts.

---

## 2. Core User Journey

1. **Discovery & Scan:** A student sits at Desk `B14`, notices a small sticker (*"Who sat here before you? Scan to open Desk B14"*), and scans it with their phone camera.
2. **Instant Gratification (Read Mode):** The browser opens `[app.domain.com/?desk=B14](https://app.domain.com/?desk=B14)` with zero sign-up screens. Work-in-progress lore is immediately visible:
* **Desk Header:** Shows Desk Name (`Desk B14`), Level (`Lvl 12: Cozy Sanctuary`), Total Hours Logged (`48.5 hrs`), and crowd-sourced physical tags (*"Working AC," "Wobbly left leg," "Outlet underneath"*).
* **Sealed Envelope Alert (Conditional):** If the immediate previous occupant left a "One-Time Capsule," a modal pops up allowing this user to open and read it.
* **The Corkboard Feed:** A scrollable timeline of past notes, 1-bit doodles, and music tracks left at `B14`.


3. **The Commitment (Focus Mode):** At the top of the screen is a floating action bar: *"Complete 20 mins of focus to sign Desk B14."* The student taps **Start Session**.
* The screen shifts into a minimalist, low-battery-drain ambient timer.
* Using the browser's `Screen Wake Lock API` and `Page Visibility API`, the timer pauses if the student switches apps to scroll social media.


4. **The Reward (Creation Mode):** When the 20-minute timer hits `00:00`, the desk gains +20 XP, and the student receives a single-use **Signing Token** valid for 15 minutes.
5. **Leaving a Mark:** The student chooses an artifact format (Sticky Note, Pixel Doodle, Song Drop, or Sealed Envelope), submits it, and watches it pin directly to the top of Desk `B14`'s timeline.

---

## 3. Functional Requirements

### 3.1 Spatial Routing & Desk Profiles (P0)

* **Dynamic Desk Resolution:** URL parameter `?desk=<id>` loads the specific desk state. Invalid desk IDs redirect to a library leaderboard overview.
* **Desk Progression System:** Desks accumulate XP based on total focus minutes completed (`1 minute = 1 XP`).
* **Lvl 1 (0 XP):** *Rookie Wooden Chair*
* **Lvl 5 (300 XP):** *Quiet Corner Spot*
* **Lvl 15 (1,000 XP):** *Scholar's Hideout*
* **Lvl 50 (5,000 XP):** *Hallowed Shrine of Lock-In*


* **Physical Spot Micro-Reviews (P1):** Users who unlock a Signing Token can toggle up to 2 predefined physical attribute badges for that desk (e.g., `⚡ Working Outlet`, `🥶 Freezing AC`, `☀️ Good Natural Light`, `🪑 Squeaky Chair`). The top 3 most-voted badges display on the desk header.

### 3.2 Anti-Cheat Focus Timer (P0)

* **Tab-Switch Detection:** Implement `document.addEventListener("visibilitychange")` to detect when the browser tab is backgrounded.
* *Grace Period:* Allow a 10-second grace period (in case the user is changing a song or checking a notification) before pausing the countdown.


* **Screen Wake Lock:** Request `navigator.wakeLock.request('screen')` so the phone screen stays dimly lit on the desk without locking mid-session.
* **Server-Side Time Verification:** When a user starts a timer, the backend issues a signed JWT (`session_token`) containing `desk_id` and `start_timestamp`. The submission API rejects any post where `current_time - start_timestamp < 19 minutes 30 seconds` to prevent API spoofing.

### 3.3 Artifact Creation Formats

Once a session completes, the user can submit **one** capsule containing any combination of the following:

| Feature | Priority | Constraints & Specs |
| --- | --- | --- |
| **Text Note** | **P0** | Max 160 characters. Plain text only (URLs stripped automatically). Optional anonymous signature (e.g., *"— Tired Architecture Student"*). |
| **1-Bit Pixel Canvas** | **P0** | A retro `128x64` black-and-white drawing pad (PictoChat style) with 2 brush sizes and an eraser. Stored as a compressed base64 PNG or raw bitmask (< 2 KB per drawing, requiring zero external blob storage). |
| **The Desk Cassette** | **P1** | Input field accepting Spotify, YouTube Music, SoundCloud, or Anghami track URLs. Backend parses OpenGraph metadata to display song title, artist, and a spinning cassette icon on the note. |
| **Sealed Envelope** | **P1** | A toggle labeled *"For the next person only."* Hides the note from the public feed. The very next unique device that scans the desk sees a wax-sealed envelope prompt. Once opened, they can either "Pin to Public Wall" or "Keep Secret (Delete)." |
| **Pass-the-Doodle** | **P2** | User draws the top half of a canvas; only the bottom 10% of their drawing is visible to the next user, who completes the bottom half to reveal the full combined image on the feed. |

### 3.4 Library Leaderboard (P1)

* A global tab showing the **Top 10 Most Active Desks This Week** across the library, driving friendly competition where students intentionally seek out specific desks to boost their rank.

---

## 4. Trust, Safety & Moderation (Zero-Account Model)

Because campus apps without login walls are prime targets for vandalism or spam, three automated layers protect the system:

1. **Layer 1: The 20-Minute Effort Wall (Behavioral Filter):** Requiring 20 minutes of active foreground screen time eliminates 95% of impulsive trolling.
2. **Layer 2: Automated AI Gatekeeper (Pre-Publish Filter):**
* Upon submission, both the text string and the `128x64` canvas image are sent to a fast, low-cost multimodal LLM API (e.g., `gemini-2.5-flash`).
* **System Prompt Rule:** Reject any submission containing profanity (in English, Arabic, or Franco-Arabic), phone numbers, social media handles (`@username`), personal full names, hate speech, or explicit/NSFW drawings.
* If flagged, the UI asks the user to edit their note without consuming their Signing Token.


3. **Layer 3: Community "Peel Off" (Post-Publish Filter):**
* Every note has a subtle *"Peel off (Report)"* icon.
* If **3 unique devices** (tracked via hashed IP + `localStorage` UUID) tap "Peel off" on the same note, its status automatically flips to `hidden` pending admin review.



---

## 5. Technical Architecture & Database Schema

### 5.1 Recommended Tech Stack

* **Frontend:** React / Next.js (or Vite + React) with Tailwind CSS. HTML5 `<canvas>` for the 1-bit drawing pad.
* **Backend:** Python (FastAPI) or Node.js (Express / Next.js API Routes).
* **Database:** PostgreSQL (via Supabase/Neon) or SQLite (if self-hosted on a VPS/home server via Docker).
* **AI Moderation:** Gemini API (`gemini-2.5-flash` free/low-cost tier).

### 5.2 Database Schema

**Table: `desks**`

* `id` (VARCHAR, PK) — e.g., `'B14'`
* `zone_name` (VARCHAR) — e.g., `'2nd Floor - Quiet Zone'`
* `total_minutes` (INT, default `0`)
* `level` (INT, default `1`)
* `tag_counts` (JSONB) — e.g., `{"outlet": 14, "cold_ac": 8, "sunny": 2}`
* `created_at` (TIMESTAMP)

**Table: `capsules**`

* `id` (UUID, PK)
* `desk_id` (VARCHAR, FK $\rightarrow$ `desks.id`)
* `author_alias` (VARCHAR(40), nullable) — e.g., `'Sleepy Senior'`
* `text_content` (VARCHAR(160), nullable)
* `doodle_data` (TEXT, nullable) — Base64 encoded 1-bit PNG (`< 2KB`)
* `track_url` (TEXT, nullable)
* `track_metadata` (JSONB, nullable) — `{"title": "...", "artist": "..."}`
* `is_sealed` (BOOLEAN, default `false`) — True if meant only for the next visitor
* `is_opened` (BOOLEAN, default `false`) — Tracks if a sealed envelope was claimed
* `report_count` (INT, default `0`)
* `status` (ENUM: `'published'`, `'hidden'`, `'flagged'`)
* `device_hash` (VARCHAR) — Anonymized hash to prevent self-reporting or spam
* `created_at` (TIMESTAMP)

**Table: `focus_sessions**`

* `id` (UUID, PK)
* `desk_id` (VARCHAR, FK $\rightarrow$ `desks.id`)
* `started_at` (TIMESTAMP)
* `completed_at` (TIMESTAMP, nullable)
* `token_used` (BOOLEAN, default `false`)

---

## 6. Non-Functional Requirements

* **Speed & Payload Size:** Initial page load after scanning the QR code must complete in **< 1.2 seconds** on spotty library Wi-Fi or 4G. Storing doodles as 1-bit monochrome strings ensures the entire feed loads in kilobytes rather than megabytes.
* **Dark/Paper UI Aesthetic:** Default to a warm, low-glare "grid paper & ink" aesthetic in daytime and a cozy dark-amber mode in the evening so phone screens on desks do not distract neighboring students.
* **Privacy:** Zero PII (Personally Identifiable Information) collected. No emails, phone numbers, or cookies tracking users outside the domain.

---

## 7. Physical Deployment & Cold-Start Strategy

1. **Sticker Design (Anti-Removal):**
* Avoid tacky neon stickers that look like ads (library staff will peel them off).
* Use clean, minimal, matte-finish stickers (`4cm x 4cm`) placed on the top-right corner of the desk surface that blend in like official library equipment:
> **[QR CODE]**
> **DESK #B14**
> *Scan to open this desk's time-capsule & focus timer*


* **Optional Hardware Upgrade:** Place an NTAG213 NFC sticker directly underneath the vinyl QR sticker so students can tap their phone against the corner of the desk without opening their camera.


2. **Solving the "Empty Desk" Cold Start:**
* Never launch with empty desks. Before placing the first 30 stickers in the library, pre-seed every desk in the database with **2 to 3 charming initial capsules** (a funny pixel drawing, a lo-fi study playlist link, and a welcoming sealed envelope) so the very first student who scans `Desk B14` immediately gets the magic experience.



---

## 8. Success Metrics (MVP Phase)

* **Scan-to-Session Conversion:** $> 35\%$ of users who scan a desk start the 20-minute focus timer.
* **Session Completion Rate:** $> 60\%$ of started timers reach `00:00` and unlock the capsule creator.
* **Viral K-Factor / Return Rate:** Average unique scans per active desk $> 4$ per day during midterm/finals weeks.
* **Moderation Health:** $< 1\%$ of published capsules require manual removal after passing the Effort Wall + AI Gatekeeper.

---

Would you like to build the interactive prototype next (starting with the database setup and the 1-bit pixel canvas component), or design the printable QR sticker batch generator first?