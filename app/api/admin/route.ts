import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Admin moderation API (Wave 7). Gated by a shared admin token via
 * `Authorization: Bearer <ADMIN_TOKEN>` on every handler — set ADMIN_TOKEN
 * in the environment (see .env.example); unset token means every request
 * is rejected with 401.
 */

const ADMIN_SELECT = {
  id: true,
  deskId: true,
  type: true,
  authorAlias: true,
  textContent: true,
  doodleData: true,
  trackUrl: true,
  reportCount: true,
  status: true,
  createdAt: true,
} as const;

function isAuthorized(request: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  // Fail closed: an unset token must never match anything.
  if (!expected) return false;

  const header = request.headers.get("authorization");
  if (!header) return false;

  const headerBuf = Buffer.from(header);
  const expectedBuf = Buffer.from(`Bearer ${expected}`);
  // timingSafeEqual throws on length mismatch — compare lengths first.
  if (headerBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(headerBuf, expectedBuf);
}

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

async function readBody(
  request: Request,
): Promise<{ id?: unknown; action?: unknown }> {
  try {
    return (await request.json()) as { id?: unknown; action?: unknown };
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const url = new URL(request.url);
  const requestedPage = Number.parseInt(url.searchParams.get("page") ?? "0", 10);
  const page = Number.isFinite(requestedPage) && requestedPage >= 0 ? requestedPage : 0;
  const pageSize = 50;
  const where: Prisma.CapsuleWhereInput = {
    status: { in: ["HIDDEN", "FLAGGED"] },
  };
  const [capsules, total] = await Promise.all([
    prisma.capsule.findMany({
      where,
      orderBy: [
        { reportCount: "desc" },
        { createdAt: "asc" },
        { id: "asc" },
      ],
      skip: page * pageSize,
      take: pageSize,
      select: { ...ADMIN_SELECT },
    }),
    prisma.capsule.count({ where }),
  ]);

  return NextResponse.json({
    capsules,
    total,
    page,
    hasMore: (page + 1) * pageSize < total,
  });
}

export async function PATCH(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const body = await readBody(request);
  const id = typeof body.id === "string" && body.id ? body.id : null;
  if (!id || body.action !== "restore") {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }

  const capsule = await prisma.capsule.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!capsule) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  // Republish and wipe the peel-off votes so the note starts clean. The
  // status predicate keeps a stale admin tab from restoring a row that was
  // already handled by somebody else.
  const restored = await prisma.$transaction(async (tx) => {
    const updated = await tx.capsule.updateMany({
      where: { id, status: { in: ["HIDDEN", "FLAGGED"] } },
      data: { status: "PUBLISHED", reportCount: 0 },
    });
    if (updated.count !== 1) return false;
    await tx.report.deleteMany({ where: { capsuleId: id } });
    return true;
  });
  if (!restored) {
    return NextResponse.json({ error: "stale-moderation-item" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isAuthorized(request)) return unauthorized();

  const body = await readBody(request);
  const id = typeof body.id === "string" && body.id ? body.id : null;
  if (!id) {
    return NextResponse.json({ error: "invalid-request" }, { status: 400 });
  }

  const capsule = await prisma.capsule.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!capsule) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  // Reports are a relation without onDelete cascade in older deployments —
  // clear them first, then delete only while the row is still moderated.
  const deleted = await prisma.$transaction(async (tx) => {
    const moderated = await tx.capsule.findFirst({
      where: { id, status: { in: ["HIDDEN", "FLAGGED"] } },
      select: { id: true },
    });
    if (!moderated) return 0;
    await tx.report.deleteMany({ where: { capsuleId: id } });
    const result = await tx.capsule.deleteMany({
      where: { id, status: { in: ["HIDDEN", "FLAGGED"] } },
    });
    return result.count;
  });
  if (deleted !== 1) {
    return NextResponse.json({ error: "stale-moderation-item" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
