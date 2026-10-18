import { Prisma } from "@prisma/client";
import type { FocusSession } from "@prisma/client";
import { prisma } from "@/lib/db";
import { verifySession, type SessionPayload } from "@/lib/jwt";
import { stripUrls } from "@/lib/text";
import { fetchTrackMetadata, isValidTrackUrl } from "@/lib/opengraph";

export const TEXT_MAX_CHARS = 160;
export const ALIAS_MAX_CHARS = 40;
// Raw 1-bit mask for 128x64 = 1024 bytes; base64 of 2048 raw bytes ≈ 2732 chars.
export const DOODLE_MAX_BYTES = 2048;
export const DOODLE_WIDTH = 128;
export const DOODLE_HEIGHT = 64;

/** Capsule as serialized over JSON (createdAt becomes an ISO string). */
export interface CapsuleDto {
  id: string;
  deskId: string;
  type: "TEXT" | "DOODLE" | "CASSETTE" | "SEALED" | "PASS_DOODLE";
  authorAlias: string | null;
  textContent: string | null;
  doodleData: string | null;
  trackUrl: string | null;
  trackMetadata: unknown;
  isSealed: boolean;
  isOpened: boolean;
  reportCount: number;
  status: "PUBLISHED" | "HIDDEN" | "FLAGGED";
  passParentId: string | null;
  createdAt: string;
}

export type CapsuleError =
  | "invalid-request"
  | "invalid-token"
  | "session-not-found"
  | "session-not-completed"
  | "token-used"
  | "empty-capsule"
  | "text-too-long"
  | "doodle-too-large"
  | "alias-too-long";

export interface TrackMetadataJson {
  title: string | null;
  artist: string | null;
  imageUrl: string | null;
}

export type CreateCapsuleResult =
  | { ok: true; capsule: CapsuleDto }
  | { ok: false; error: CapsuleError };

/**
 * Strip raw URLs from note text (canonical implementation lives in
 * lib/text.ts; re-exported here for dependents that import it from module).
 */
export { stripUrls };

/** Guard against junk doodle payloads: valid base64, ≤2048 raw bytes, no extra fields. */
export function isValidDoodleData(doodleData: string): boolean {
  if (doodleData.length === 0 || doodleData.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(doodleData)) {
    return false;
  }
  let rawLength = (doodleData.length / 4) * 3;
  if (doodleData.endsWith("==")) rawLength -= 2;
  else if (doodleData.endsWith("=")) rawLength -= 1;
  return rawLength > 0 && rawLength <= DOODLE_MAX_BYTES;
}

/** Exactly one 128x64 bitmask: 16 bytes/row × 64 rows = 1024 raw bytes. */
export const DOODLE_FULL_BYTES = (DOODLE_WIDTH / 8) * DOODLE_HEIGHT; // 1024
/** The top half (rows 0–31) = 512 raw bytes (Pass-the-Doodle boundary, PRD §3.3 P2). */
export const DOODLE_TOP_HALF_BYTES = DOODLE_FULL_BYTES / 2; // 512

/** A pass-doodle payload must decode to exactly one full 1024-byte bitmask. */
export function isFullBitmask(doodleData: string): boolean {
  if (!isValidDoodleData(doodleData)) return false;
  return Buffer.from(doodleData, "base64").length === DOODLE_FULL_BYTES;
}

/**
 * A pass-doodle PARENT drawing: full-size payload whose bottom half
 * (rows 32–63) is blank — only the top half carries ink.
 */
export function isTopHalfOnly(doodleData: string): boolean {
  if (!isFullBitmask(doodleData)) return false;
  const raw = Buffer.from(doodleData, "base64");
  return raw.subarray(DOODLE_TOP_HALF_BYTES).every((byte) => byte === 0);
}

/**
 * Validate a Signing Token for artifact creation without consuming it
 * (PRD §3.2: verifySession signature → session row → effort wall).
 * Single-use enforcement stays with the caller via a guarded
 * `tokenUsed: false → true` updateMany inside their transaction.
 * Returns null for an invalid signature, an unknown session, or an
 * unfinished (not-completed) session.
 */
export interface SignedSession {
  session: FocusSession;
  payload: SessionPayload;
}

export async function verifySigningToken(token: string): Promise<SignedSession | null> {
  const payload = verifySession(token);
  if (!payload) return null;
  const session = await prisma.focusSession.findUnique({
    where: { id: payload.sessionId },
  });
  if (!session || !session.completedAt) return null;
  return { session, payload };
}

/**
 * Bounded memo for the BMP data URI (rebuilt on every CapsuleCard render
 * otherwise). Keyed by the input base64; evicts the oldest entry when full.
 */
const bmpDataUriCache = new Map<string, string | null>();
const BMP_CACHE_MAX_ENTRIES = 100;

/**
 * Convert a stored 128×64 bitmask into a renderable 1-bit BMP data URI.
 * BMP rows run bottom-up and pixels are MSB-first, so each byte is
 * bit-reversed and each row flipped vertically; the palette maps
 * background=white, ink=black (bit set = ink, same as PixelCanvas).
 * Returns null for anything that is not exactly one 1024-byte bitmask.
 */
export function doodleBmpDataUri(doodleData: string | null): string | null {
  if (!doodleData || !isFullBitmask(doodleData)) return null;
  const cached = bmpDataUriCache.get(doodleData);
  if (cached !== undefined) return cached;

  const uri = buildDoodleBmpDataUri(doodleData);

  if (bmpDataUriCache.size >= BMP_CACHE_MAX_ENTRIES) {
    const oldest = bmpDataUriCache.keys().next().value;
    if (oldest !== undefined) bmpDataUriCache.delete(oldest);
  }
  bmpDataUriCache.set(doodleData, uri);
  return uri;
}

function buildDoodleBmpDataUri(doodleData: string): string {
  const raw = Buffer.from(doodleData, "base64");

  const FILE_HEADER_BYTES = 14;
  const DIB_HEADER_BYTES = 40;
  const PALETTE_BYTES = 8; // two 1-bit BGRA entries
  const PIXEL_DATA_OFFSET = FILE_HEADER_BYTES + DIB_HEADER_BYTES + PALETTE_BYTES; // 62
  const FILE_BYTES = PIXEL_DATA_OFFSET + DOODLE_FULL_BYTES; // 62 + 1024 = 1086

  const bmp = Buffer.alloc(FILE_BYTES);
  bmp.write("BM", 0, "ascii");
  bmp.writeUInt32LE(FILE_BYTES, 2);
  bmp.writeUInt32LE(0, 6); // reserved
  bmp.writeUInt32LE(PIXEL_DATA_OFFSET, 10);
  bmp.writeUInt32LE(DIB_HEADER_BYTES, 14);
  bmp.writeInt32LE(DOODLE_WIDTH, 18);
  bmp.writeInt32LE(DOODLE_HEIGHT, 22); // positive → bottom-up rows
  bmp.writeUInt16LE(1, 26); // color planes
  bmp.writeUInt16LE(1, 28); // bits per pixel
  bmp.writeUInt32LE(0, 30); // BI_RGB, uncompressed
  bmp.writeUInt32LE(DOODLE_FULL_BYTES, 34); // image size
  bmp.writeInt32LE(2835, 38); // 2835 px/m ≈ 72 DPI, both axes
  bmp.writeInt32LE(2835, 42);
  bmp.writeUInt32LE(2, 46); // palette entries used
  bmp.writeUInt32LE(2, 50); // important entries
  // Entry 0 = background (white BGR), entry 1 = ink (black BGR).
  bmp.writeUInt8(0xff, 54);
  bmp.writeUInt8(0xff, 55);
  bmp.writeUInt8(0xff, 56);
  bmp.writeUInt8(0x00, 57);

  for (let row = 0; row < DOODLE_HEIGHT; row++) {
    const dstRow = DOODLE_HEIGHT - 1 - row; // BMP stores rows bottom-up
    for (let i = 0; i < DOODLE_WIDTH / 8; i++) {
      const src = raw[row * (DOODLE_WIDTH / 8) + i];
      // Reverse bits so the source's LSB-first (col & 7) becomes the
      // BMP's MSB-first leftmost-pixel convention.
      let reversed = 0;
      for (let bit = 0; bit < 8; bit++) {
        if (src & (1 << bit)) reversed |= 1 << (7 - bit);
      }
      bmp[PIXEL_DATA_OFFSET + dstRow * (DOODLE_WIDTH / 8) + i] = reversed;
    }
  }

  return `data:image/bmp;base64,${bmp.toString("base64")}`;
}

/**
 * Consume a Signing Token and create a capsule, atomically.
 *
 * Signing-token validation order (contract for this API):
 *   1. verifySession(token)                      -> null            => invalid-token
 *   2. load FocusSession by payload.sessionId    -> missing        => session-not-found
 *   3. require completedAt != null (effort wall) -> null           => session-not-completed
 *   4. require tokenUsed === false (single use)  -> already used   => token-used
 *   5. transactionally: flip tokenUsed=true FIRST, then create the capsule,
 *      so two concurrent submits with the same token cannot both succeed.
 *
 * P1 formats (PRD §3.3):
 *   - trackUrl present   → type CASSETTE; OpenGraph metadata fetched
 *     server-side (best-effort, non-blocking failure) and stored as
 *     trackMetadata JSON. The OpenGraph fetch happens AFTER token
 *     verification (so unauthenticated callers cannot trigger outbound
 *     fetches) but BEFORE the DB transaction so a slow provider never
 *     extends that transaction.
 *   - isSealed true      → type SEALED, isSealed=true; requires a text note.
 *     Hidden from the public feed (getDeskFeed filters it) and claimed by
 *     the next unique device via app/api/capsules/[id]/route.ts.
 *   - isPassDoodle true  → type PASS_DOODLE (highest precedence), created as
 *     a PARENT (passParentId=null) whose doodleData must be a full 128x64
 *     bitmask drawing ONLY the top half (rows 32–63 blank). Hidden from the
 *     feed until continued; surfaced via getPendingPassDoodle.
 */
export async function createCapsule(input: {
  sessionToken: string;
  textContent?: string;
  doodleData?: string;
  authorAlias?: string;
  trackUrl?: string;
  isSealed?: boolean;
  isPassDoodle?: boolean;
  deviceHash: string;
}): Promise<CreateCapsuleResult> {
  const { sessionToken, deviceHash } = input;

  const textRaw = typeof input.textContent === "string" ? input.textContent : "";
  const doodleData = typeof input.doodleData === "string" ? input.doodleData : "";
  const aliasRaw = typeof input.authorAlias === "string" ? input.authorAlias : "";
  const trackUrlRaw =
    typeof input.trackUrl === "string" ? input.trackUrl.trim() : "";
  const isSealed = input.isSealed === true;
  const isPassDoodle = input.isPassDoodle === true;

  const text = textRaw ? stripUrls(textRaw).slice(0, TEXT_MAX_CHARS) : "";
  const alias = aliasRaw ? aliasRaw.trim().slice(0, ALIAS_MAX_CHARS) : null;

  if (textRaw.length > TEXT_MAX_CHARS * 4) return { ok: false, error: "text-too-long" };
  if (doodleData && !isValidDoodleData(doodleData)) return { ok: false, error: "doodle-too-large" };
  if (aliasRaw.length > ALIAS_MAX_CHARS) return { ok: false, error: "alias-too-long" };

  // Sealed envelopes are private hand-me-downs: a written note is required
  // (a standalone doodle can be pinned publicly instead).
  if (isSealed && !text) return { ok: false, error: "empty-capsule" };

  // Pass-doodle parents are images only: no text/trackUrl mixing, and the
  // merged canvas later requires an exact full bitmask with a blank bottom.
  if (isPassDoodle && (!doodleData || text || trackUrlRaw)) {
    return { ok: false, error: "empty-capsule" };
  }
  if (isPassDoodle && !isTopHalfOnly(doodleData)) {
    return { ok: false, error: "invalid-request" };
  }

  // Type resolution (PRD §3.3): pass-doodle parent > sealed > cassette >
  // wrapped doodle > text.
  const type: "TEXT" | "DOODLE" | "CASSETTE" | "SEALED" | "PASS_DOODLE" = isPassDoodle
    ? "PASS_DOODLE"
    : isSealed
      ? "SEALED"
      : trackUrlRaw
        ? "CASSETTE"
        : doodleData
          ? "DOODLE"
          : "TEXT";

  // Wrapped doodles (and any doodle riding a sealed note) must be exactly
  // one 128x64 bitmask: the renderer decodes a full 1024-byte mask, never a
  // partial payload. PASS_DOODLE parents are already validated with
  // isTopHalfOnly (which itself implies isFullBitmask).
  if ((type === "DOODLE" || type === "SEALED") && doodleData && !isFullBitmask(doodleData)) {
    return { ok: false, error: "doodle-too-large" };
  }

  if (!text && !doodleData && !trackUrlRaw) return { ok: false, error: "empty-capsule" };

  const payload = verifySession(sessionToken);
  if (!payload) return { ok: false, error: "invalid-token" };

  const session = await prisma.focusSession.findUnique({
    where: { id: payload.sessionId },
  });
  if (!session) return { ok: false, error: "session-not-found" };
  // Effort wall: the session must be completed server-side before anything ships.
  if (!session.completedAt) return { ok: false, error: "session-not-completed" };

  // OpenGraph metadata fetch happens only after the signing token is
  // verified and the payload checks pass (SSRF ordering guard: unauthenticated
  // callers can no longer trigger the outbound fetch), and stays OUTSIDE the
  // DB transaction so a slow provider never extends the transaction.
  let trackMetadata: TrackMetadataJson | null = null;
  if (trackUrlRaw) {
    if (!isValidTrackUrl(trackUrlRaw)) return { ok: false, error: "invalid-request" };
    const meta = await fetchTrackMetadata(trackUrlRaw);
    trackMetadata = {
      title: meta.title ?? null,
      artist: meta.artist ?? null,
      imageUrl: meta.imageUrl ?? null,
    };
  }

  const tokenResult = await prisma.$transaction(async (tx) => {
    // Consume first (guarded update), create second — both in one transaction.
    const consumed = await tx.focusSession.updateMany({
      where: { id: session.id, tokenUsed: false, completedAt: { not: null } },
      data: { tokenUsed: true },
    });
    if (consumed.count !== 1) {
      return { ok: false as const, error: "token-used" as const };
    }

    const capsule = await tx.capsule.create({
      data: {
        // deskId comes from the trusted DB session row, never from the client.
        deskId: session.deskId,
        type,
        authorAlias: alias || null,
        textContent: text || null,
        doodleData: doodleData || null,
        trackUrl: trackUrlRaw || null,
        trackMetadata: trackMetadata
          ? ({ ...trackMetadata } as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        isSealed,
        status: "PUBLISHED",
        deviceHash,
      },
    });
    return { ok: true as const, capsule: serializeCapsule(capsule) };
  });

  return tokenResult;
}

/**
 * Shared capsule → DTO serializer (also used by the claim/pin/delete route).
 * `deviceHash` is intentionally NOT serialized: it is the author's stable
 * per-device identifier and other users must never receive it. Server-side
 * comparisons keep reading it straight off the Prisma row, not the DTO.
 */
export function serializeCapsule(capsule: {
  id: string;
  deskId: string;
  type: "TEXT" | "DOODLE" | "CASSETTE" | "SEALED" | "PASS_DOODLE";
  authorAlias: string | null;
  textContent: string | null;
  doodleData: string | null;
  trackUrl: string | null;
  trackMetadata: unknown;
  isSealed: boolean;
  isOpened: boolean;
  reportCount: number;
  status: "PUBLISHED" | "HIDDEN" | "FLAGGED";
  passParentId: string | null;
  createdAt: Date;
}): CapsuleDto {
  return {
    id: capsule.id,
    deskId: capsule.deskId,
    type: capsule.type,
    authorAlias: capsule.authorAlias,
    textContent: capsule.textContent,
    doodleData: capsule.doodleData,
    trackUrl: capsule.trackUrl,
    trackMetadata: capsule.trackMetadata,
    isSealed: capsule.isSealed,
    isOpened: capsule.isOpened,
    reportCount: capsule.reportCount,
    status: capsule.status,
    passParentId: capsule.passParentId,
    createdAt: capsule.createdAt.toISOString(),
  };
}
