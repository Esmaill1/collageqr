import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
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

  const capsules = await prisma.capsule.findMany({
    where: { status: { in: ["HIDDEN", "FLAGGED"] } },
    orderBy: { reportCount: "desc" },
    take: 50,
    select: { ...ADMIN_SELECT },
  });

  return NextResponse.json({ capsules });
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

  // Republish and wipe the peel-off votes so the note starts clean.
  await prisma.$transaction([
    prisma.report.deleteMany({ where: { capsuleId: id } }),
    prisma.capsule.update({
      where: { id },
      data: { status: "PUBLISHED", reportCount: 0 },
    }),
  ]);

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

  // Reports are a relation without onDelete cascade — clear them first.
  await prisma.$transaction([
    prisma.report.deleteMany({ where: { capsuleId: id } }),
    prisma.capsule.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
