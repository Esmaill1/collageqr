import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { verifySession } from "@/lib/jwt";
import { prisma } from "@/lib/db";
import { applyDeviceCookie, getDeviceContext } from "@/lib/device";

export const dynamic = "force-dynamic";

const CANONICAL_BADGES = new Set([
  "outlet",
  "cold_ac",
  "sunny",
  "squeaky",
  "wobbly",
  "quiet",
]);

const MAX_BADGES = 2;

/**
 * Physical Spot Micro-Reviews (PRD §3.1 P1).
 * POST body: { signingToken, badges: string[] } (≤ 2 canonical keys).
 *
 * The signing token is VERIFIED but NOT consumed: tokenUsed is left
 * untouched, so badge voting never burns the capsule token. Replay is
 * blocked by a BadgeVote row instead — one (deskId, deviceHash) per desk,
 * ever: the row is created inside the same transaction that increments
 * tagCounts, so a duplicate vote fails atomically and counts never move.
 * Each badge key is applied with a single atomic SQL UPDATE — jsonb_set
 * performs the read-modify-write in one statement, so concurrent votes
 * cannot clobber each other's counts.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: deskId } = await params;

  // Cookie-based device identity (finding #7): compute first so every
  // response path below can carry a minted dl_device cookie.
  const device = await getDeviceContext();
  const res = (body: unknown, status: number) =>
    applyDeviceCookie(NextResponse.json(body, { status }), device);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return res({ error: "invalid-request" }, 400);
  }

  if (typeof body !== "object" || body === null) {
    return res({ error: "invalid-request" }, 400);
  }

  const { signingToken, badges } = body as {
    signingToken?: unknown;
    badges?: unknown;
  };

  if (typeof signingToken !== "string" || signingToken.length === 0) {
    return res({ error: "invalid-token" }, 401);
  }

  if (
    !Array.isArray(badges) ||
    badges.length === 0 ||
    badges.length > MAX_BADGES ||
    !badges.every((b) => typeof b === "string" && CANONICAL_BADGES.has(b))
  ) {
    return res({ error: "invalid-badges" }, 400);
  }

  const payload = verifySession(signingToken);
  if (!payload) {
    return res({ error: "invalid-token" }, 401);
  }

  const session = await prisma.focusSession.findUnique({
    where: { id: payload.sessionId },
    select: { deskId: true, completedAt: true },
  });
  if (!session) {
    return res({ error: "session-not-found" }, 404);
  }
  // Effort wall: ratings unlock exactly like capsule creation.
  if (!session.completedAt) {
    return res({ error: "session-not-completed" }, 403);
  }
  if (session.deskId !== deskId) {
    return res({ error: "desk-mismatch" }, 403);
  }

  const deskExists = await prisma.desk.findUnique({
    where: { id: deskId },
    select: { id: true },
  });
  if (!deskExists) {
    return res({ error: "not-found" }, 404);
  }

  // One device, one badge-set vote per desk, ever. The BadgeVote row is the
  // dedup: unique (deskId, deviceHash) — a replay from the same device hits
  // P2002 and the whole transaction (row + all count increments) rolls back.
  // The hash is now keyed on the server-issued dl_device cookie, so rotating
  // client headers can no longer mint extra votes.
  const deviceHash = device.deviceHash;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.badgeVote.create({
        data: { deskId, deviceHash },
      });
      for (const badge of badges as string[]) {
        await tx.$executeRaw`
          UPDATE "desks"
          SET "tag_counts" = jsonb_set(
            "tag_counts",
            ARRAY[${badge}::text],
            to_jsonb(COALESCE("tag_counts"->>${badge}::text, '0')::int + 1)
          )
          WHERE "id" = ${deskId}
        `;
      }
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res({ error: "already-voted" }, 409);
    }
    throw err;
  }

  const desk = await prisma.desk.findUnique({
    where: { id: deskId },
    select: { tagCounts: true },
  });

  return res({ ok: true, tagCounts: desk?.tagCounts ?? {} }, 200);
}
