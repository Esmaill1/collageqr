import { NextResponse } from "next/server";
import {
  DOODLE_FULL_BYTES,
  DOODLE_TOP_HALF_BYTES,
  isFullBitmask,
  serializeCapsule,
  verifySigningToken,
} from "@/lib/capsule";
import {
  applyDeviceCookie,
  getDeviceContext,
  type DeviceContext,
} from "@/lib/device";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/jwt";

export const dynamic = "force-dynamic";

/**
 * Pass-the-Doodle continuation (PRD §3.3 P2, Plan §5 Wave 6).
 *
 * POST /api/capsules/[id]/continue  { sessionToken, doodleData }
 *
 * [id] is a PARENT pass-doodle capsule (type PASS_DOODLE, passParentId=null).
 * The caller — the next occupant of the desk who just finished a focus
 * session — supplies the MERGED full 128×64 bitmask (parent top half + their
 * fresh bottom half) and this route publishes the CHILD capsule that joins
 * the chain. The stored image is composed SERVER-SIDE from the parent's
 * trusted top half and the submitted bottom half, so a child can only
 * contribute the bottom half — never the whole picture.
 *
 *   child: type=PASS_DOODLE, passParentId=parent.id — shown in the feed as
 *   the completed collaborative doodle. The parent itself never reaches the
 *   feed (getDeskFeed excludes pass-doodle parents).
 *
 * Error codes:
 *   invalid-request       400  bad JSON / doodleData is not one 1024-byte bitmask
 *   invalid-token         401  sessionToken signature failed
 *   session-not-completed 403  focus effort wall not passed
 *   desk-mismatch         403  signing token earned on a different desk
 *   session-not-found     404  signed session no longer exists
 *   parent-not-found      404  [id] missing / not a pass-doodle parent / not PUBLISHED
 *   token-used            409  this signing token already produced an artifact
 *   already-continued     409  someone already finished this half-doodle
 */
const HTTP_STATUS = {
  "invalid-request": 400,
  "invalid-token": 401,
  "session-not-completed": 403,
  "desk-mismatch": 403,
  "session-not-found": 404,
  "parent-not-found": 404,
  "token-used": 409,
  "already-continued": 409,
} as const;

type ContinueError = keyof typeof HTTP_STATUS;

function fail(error: ContinueError, device?: DeviceContext) {
  // When a dl_device cookie was minted this request, carry it on the error
  // response too (pass undefined while no device context is at hand).
  return applyDeviceCookie(
    NextResponse.json({ error }, { status: HTTP_STATUS[error] }),
    device ?? {},
  );
}

/** Unique-violation probe (same pattern as the peek/report route). */
function isUniqueViolation(error: unknown) {
  return (error as { code?: string } | null)?.code === "P2002";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Cookie-based device identity (finding #7): compute first so every
  // response path below can carry a minted dl_device cookie.
  const device = await getDeviceContext();
  const res = (body: unknown, status: number) =>
    applyDeviceCookie(NextResponse.json(body, { status }), device);
  // Every error terminal also carries the minted dl_device cookie.
  const failWith = (error: ContinueError) => fail(error, device);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failWith("invalid-request");
  }
  if (typeof body !== "object" || body === null) {
    return failWith("invalid-request");
  }
  const { sessionToken, doodleData } = body as {
    sessionToken?: unknown;
    doodleData?: unknown;
  };

  if (typeof sessionToken !== "string" || sessionToken.length === 0) {
    return failWith("invalid-token");
  }
  // The merged payload must decode to exactly one 128×64 bitmask.
  if (typeof doodleData !== "string" || !isFullBitmask(doodleData)) {
    return failWith("invalid-request");
  }

  // Parent must exist, be a pass-doodle, still be a PARENT
  // (passParentId=null — children must not be "continued" again),
  // and still be PUBLISHED — a HIDDEN/FLAGGED parent is moderated
  // content and must never be republished as a new continuation.
  // Its doodleData must decode to one full 1024-byte bitmask so the
  // server can compose the merged image from its top half.
  const parent = await prisma.capsule.findUnique({
    where: { id, status: "PUBLISHED" },
  });
  const parentRaw =
    parent && parent.doodleData
      ? Buffer.from(parent.doodleData, "base64")
      : null;
  if (
    !parent ||
    parent.type !== "PASS_DOODLE" ||
    parent.passParentId !== null ||
    !parentRaw ||
    parentRaw.length !== DOODLE_FULL_BYTES
  ) {
    return failWith("parent-not-found");
  }

  // Effort wall (same contract as createCapsule, PRD §3.2):
  //   1. signature → invalid-token
  //   2. session row → session-not-found
  //   3. completedAt → session-not-completed
  //   4. tokenUsed=false → token-used (re-checked transactionally below)
  const signed = await verifySigningToken(sessionToken);
  if (!signed) {
    // Disambiguate the null per the lib/capsule verification order.
    const payload = verifySession(sessionToken);
    if (!payload) return failWith("invalid-token");
    const session = await prisma.focusSession.findUnique({
      where: { id: payload.sessionId },
    });
    if (!session) return failWith("session-not-found");
    if (!session.completedAt) return failWith("session-not-completed");
    return failWith("token-used");
  }
  if (signed.session.tokenUsed) return failWith("token-used");

  // Cross-desk guard: the token was earned at the end of a focus session
  // on SOME desk — it must be THIS desk's half-doodle, not another's.
  if (signed.session.deskId !== parent.deskId) {
    return failWith("desk-mismatch");
  }

  const deskId = parent.deskId;
  const sessionId = signed.session.id;
  const deviceHash = device.deviceHash;

  // Server-side composition (finding #10): the client submits only its
  // fresh BOTTOM half contribution; the stored child must be built from
  // the trusted parent row's TOP half, not from whatever the client sent.
  // Bitmask layout: byte i = row*16 + (col>>3), bit = col & 7, so the
  // top half (rows 0–31) is bytes 0–511 and the bottom half (rows 32–63)
  // is bytes 512–1023.
  const childRaw = Buffer.from(doodleData, "base64");
  const merged = Buffer.alloc(DOODLE_FULL_BYTES);
  merged.set(parentRaw.subarray(0, DOODLE_TOP_HALF_BYTES), 0);
  merged.set(childRaw.subarray(DOODLE_TOP_HALF_BYTES), DOODLE_TOP_HALF_BYTES);
  const mergedDoodleData = merged.toString("base64");

  const result = await prisma.$transaction(async (tx) => {
    // Consume first (guarded update), create second — in one transaction,
    // so two concurrent continuations of the same token cannot both succeed
    // and two different devices cannot both answer the same half-doodle.
    const consumed = await tx.focusSession.updateMany({
      where: { id: sessionId, tokenUsed: false, completedAt: { not: null } },
      data: { tokenUsed: true },
    });
    if (consumed.count !== 1) {
      return { ok: false as const, error: "token-used" as const };
    }

    // Race re-check INSIDE the transaction: only the first continuation
    // wins. The schema's @@unique([passParentId]) is the hard guarantee;
    // this early exit also avoids consuming a token against a finished
    // doodle and lets the loser below get an accurate 409.
    const existingChild = await tx.capsule.findFirst({
      where: { passParentId: id },
      select: { id: true },
    });
    if (existingChild) {
      return { ok: false as const, error: "already-continued" as const };
    }

    let capsule;
    try {
      capsule = await tx.capsule.create({
        data: {
          // deskId from the trusted parent row, never from the client.
          deskId,
          type: "PASS_DOODLE",
          passParentId: id,
          // Server-composed image: parent's top half + the child's
          // submitted bottom half — the client's top half is ignored.
          doodleData: mergedDoodleData,
          deviceHash,
          status: "PUBLISHED",
        },
      });
    } catch (error) {
      // Two transactions can both win the findFirst race window above;
      // the unique constraint then rejects the second create (P2002).
      if (isUniqueViolation(error)) {
        return { ok: false as const, error: "already-continued" as const };
      }
      throw error;
    }
    return { ok: true as const, capsule: serializeCapsule(capsule) };
  });

  if (!result.ok) {
    return fail(result.error, device);
  }

  return res({ ok: true, capsule: result.capsule }, 201);
}
