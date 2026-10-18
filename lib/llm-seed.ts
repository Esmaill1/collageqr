// lib/llm-seed.ts — seed content generation for the cold-start script.
// Optional LLM path (Gemini) with a deterministic hand-written fallback.

export type SeedNote = {
  text: string;
  alias: string;
};

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function buildPrompt(count: number): string {
  return `Write ${count} short notes that a previous student might leave on a university library desk time-capsule app.

Rules for each note:
- Maximum 160 characters. Plain text only.
- No URLs, no phone numbers, no social media handles, no real names.
- No profanity.
- Mix of encouraging, gently funny, and atmospheric (e.g. "The AC here is criminal", "Good natural light at 4pm").
- Each note has a short playful author alias (e.g. "Frozen Senior", "Quiet Friend", "Sleepy Freshman"). Max 40 characters.

Return STRICT JSON only: an array of exactly ${count} objects like {"text": "...", "alias": "..."}. No markdown fences, no commentary.`;
}

const SAFETY_PROMPT =
  "You generate wholesome, friendly seed content for a student study app. Output only the requested strict JSON array. Keep every note <=160 characters, plain text, no URLs, no profanity, no real names.";

const FALLBACK_POOL: SeedNote[] = [
  { text: "You got this. One paragraph at a time.", alias: "Anonymous" },
  { text: "The AC here is criminal. Bring a hoodie.", alias: "Frozen Senior" },
  { text: "Best desk on this floor. Don't tell anyone.", alias: "Keeper of B14" },
  { text: "If you're reading this, take a breath. You're doing fine.", alias: "Quiet Friend" },
  { text: "Someone once cried at this desk and still passed. You will too.", alias: "Legend of the Desk" },
  { text: "4pm sunlight on this desk is unreal. Schedule accordingly.", alias: "Sun Chaser" },
  { text: "I finished my thesis abstract here. Your turn for greatness.", alias: "Thesis Ghost" },
  { text: "Left leg wobbles. Consider it a tiny focus challenge.", alias: "Wobbly Desk Enjoyer" },
  { text: "The outlet under this desk changed my life. Pass it on.", alias: "Charged & Grateful" },
  { text: "Midterms survivors of this desk unite. We made it, you will too.", alias: "Survivor '26" },
  { text: "Pro tip: eyes off the phone, coffee in hand, ten deep breaths. Go.", alias: "Kind Stranger" },
  { text: "This desk has heard more sighs than a therapy office. Keep going.", alias: "Fellow Sigher" },
  { text: "I left one pomodoro here. It's yours. Spend it wisely.", alias: "Pomodoro Benefactor" },
  { text: "The person before you believes in you. They just didn't say it out loud.", alias: "Believer" },
  { text: "Studied here through a heartbreak. This desk is stronger than it looks. So are you.", alias: "Resilient Romantic" },
  { text: "Great natural light. Books look 30% more interesting here.", alias: "Golden Hour Studier" },
  { text: "Somewhere a deadline is scared of you right now.", alias: "Deadline Menace" },
  { text: "Welcome. Same chair, new chapter. Make it count.", alias: "The Predecessor" },
  { text: "I lost my pen here. If you find it, it's yours. Good luck energy included.", alias: "Pen Philanthropist" },
  { text: "This desk raised three GPAs. Add yours to the family.", alias: "GPA Godparent" },
  { text: "Saw a pigeon judge me through this window. Do better than me.", alias: "Pigeon Witness" },
  { text: "Focus for twenty minutes. Future you says thanks in advance.", alias: "Future You" },
  { text: "This desk hums with the ghosts of all-nighters. Respectful ghosts. They help.", alias: "Ghost Liaison" },
  { text: "If stuck, write one ugly sentence. Ugly sentences become good essays.", alias: "Ugly Sentence Coach" },
  { text: "The vending machine on this floor eats coins. Bring exact change and courage.", alias: "Vending Machine Veteran" },
  { text: "Quiet zone. Let your brain be the loudest thing here.", alias: "Silence Admirer" },
  { text: "Chapter five hates everyone. Don't take it personally.", alias: "Ch 5 Survivor" },
  { text: "Sat here with a fever and a deadline. The desk absorbed some of it for me.", alias: "Fever Dream Graduate" },
  { text: "Little scribble in the wood grain looks like a cat. That's your study buddy now.", alias: "Wood Cat Finder" },
  { text: "By the time you read this, my exam is over. One of us is free.", alias: "Escaped Student" },
];

// Deterministic-enough shuffle for seed variety.
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function stripFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "");
  }
  return s.trim();
}

function parseNotes(json: string, count: number): SeedNote[] | null {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return null;
    const notes: SeedNote[] = [];
    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;
      const { text, alias } = item as { text?: unknown; alias?: unknown };
      if (typeof text !== "string" || typeof alias !== "string") continue;
      if (text.length === 0 || text.length > 160) continue;
      if (alias.length === 0 || alias.length > 40) continue;
      notes.push({ text, alias });
      if (notes.length >= count) break;
    }
    return notes.length >= Math.min(count, 5) ? notes : null;
  } catch {
    return null;
  }
}

export async function generateSeedNotes(count: number): Promise<SeedNote[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(count) }] }],
          systemInstruction: { parts: [{ text: SAFETY_PROMPT }] },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini returned no text");
      const notes = parseNotes(stripFences(text), count);
      if (notes) return notes;
    } catch {
      // fall through to template pool
    }
  }
  return shuffle(FALLBACK_POOL).slice(0, count);
}

// ---------------------------------------------------------------------------
// Procedural 1-bit doodles
//
// Encoding (must match PixelCanvas / CapsuleCard):
//   - canvas: 128 x 64, 1 bit per pixel
//   - 1024 bytes total (16 bytes per row = 128/8)
//   - byte index  = row * 16 + (col >> 3)
//   - bit within byte = col & 7  (bit set = ink)
//   - stored as base64 of the raw 1024-byte buffer
// ---------------------------------------------------------------------------

const CANVAS_BYTES_PER_ROW = 16; // 128 / 8
const CANVAS_BYTES = 1024; // 16 * 64

export type DoodleKind = "smiley" | "heart" | "star" | "arrow" | "wave";

function setBit(buf: Uint8Array, col: number, row: number): void {
  if (col < 0 || col >= 128 || row < 0 || row >= 64) return;
  const idx = row * CANVAS_BYTES_PER_ROW + (col >> 3);
  buf[idx] = buf[idx] | (1 << (col & 7));
}

function toBase64(buf: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buf.length; i += 4096) {
    const chunk = buf.subarray(i, Math.min(i + 4096, buf.length));
    binary += String.fromCharCode(...Array.from(chunk));
  }
  return btoa(binary);
}

function circle(buf: Uint8Array, cx: number, cy: number, r: number, fill = false): void {
  const r2 = r * r;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (fill) {
        if (d2 <= r2) setBit(buf, x, y);
      } else if (d2 <= r2 && d2 > (r - 1.6) * (r - 1.6)) {
        setBit(buf, x, y);
      }
    }
  }
}

function line(buf: Uint8Array, x0: number, y0: number, x1: number, y1: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    setBit(buf, Math.round(x0 + t * (x1 - x0)), Math.round(y0 + t * (y1 - y0)));
  }
}

function drawSmiley(buf: Uint8Array): void {
  circle(buf, 64, 32, 18); // face outline
  circle(buf, 56, 25, 2, true); // left eye
  circle(buf, 72, 25, 2, true); // right eye
  // smile: lower arc of an auxiliary circle
  const sr = 13;
  for (let x = 51; x <= 77; x++) {
    const dx = x - 64;
    const y = 28 + Math.round(Math.sqrt(Math.max(0, sr * sr - dx * dx)));
    setBit(buf, x, y);
  }
}

function drawHeart(buf: Uint8Array): void {
  // Simple heart: two circles + two diagonals forming the point.
  circle(buf, 57, 26, 7);
  circle(buf, 71, 26, 7);
  line(buf, 50, 31, 64, 48);
  line(buf, 78, 31, 64, 48);
}

function drawStar(buf: Uint8Array): void {
  const cx = 64;
  const cy = 33;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 19 : 8;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([Math.round(cx + r * Math.cos(a)), Math.round(cy + r * Math.sin(a))]);
  }
  for (let i = 0; i < 10; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % 10];
    line(buf, p[0], p[1], q[0], q[1]);
  }
}

function drawArrow(buf: Uint8Array): void {
  const shaftY = 32;
  const shaftStart = 35;
  const headBase = 80;
  const tip = 93;
  // shaft
  for (let x = shaftStart; x <= headBase; x++) {
    setBit(buf, x, shaftY);
    setBit(buf, x, shaftY + 1);
  }
  // head
  line(buf, headBase, shaftY - 13, tip, shaftY);
  line(buf, headBase, shaftY + 13, tip, shaftY);
  line(buf, headBase, shaftY - 13, headBase, shaftY + 13);
}

function drawWave(buf: Uint8Array): void {
  for (let x = 8; x <= 120; x++) {
    const y = 32 + Math.round(11 * Math.sin(((x - 8) / 112) * Math.PI * 2));
    setBit(buf, x, y);
    setBit(buf, x, y + 1);
  }
}

export function generateProceduralDoodle(kind: DoodleKind): string {
  const buf = new Uint8Array(CANVAS_BYTES);
  switch (kind) {
    case "smiley":
      drawSmiley(buf);
      break;
    case "heart":
      drawHeart(buf);
      break;
    case "star":
      drawStar(buf);
      break;
    case "arrow":
      drawArrow(buf);
      break;
    case "wave":
      drawWave(buf);
      break;
  }
  return toBase64(buf);
}


