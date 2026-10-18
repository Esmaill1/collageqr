import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { signSession } from "@/lib/jwt";
import { applyDeviceCookie, getDeviceContext } from "@/lib/device";

const SESSION_DURATION_MS = 20 * 60 * 1000;

export async function POST(request: Request) {
  // Cookie bootstrap (finding #7): this is the most common first POST a
  // visitor makes (Start Session). Minting and setting the dl_device cookie
  // here establishes their stable device identity for every later request
  // (report dedup, badge votes, sealed-envelope claiming).
  const device = await getDeviceContext();
  const res = (body: unknown, status: number) =>
    applyDeviceCookie(NextResponse.json(body, { status }), device);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return res({ error: "invalid-json" }, 400);
  }

  const { deskId } =
    body !== null && typeof body === "object"
      ? (body as { deskId?: unknown })
      : {};

  if (typeof deskId !== "string" || deskId.trim().length === 0) {
    return res({ error: "missing-desk-id" }, 400);
  }

  const desk = await prisma.desk.findUnique({ where: { id: deskId } });
  if (!desk) {
    return res({ error: "desk-not-found" }, 404);
  }

  const session = await prisma.focusSession.create({
    data: {
      deskId,
      startedAt: new Date(),
    },
  });

  const startedAt = session.startedAt.getTime();
  const sessionToken = signSession({
    deskId,
    sessionId: session.id,
    startedAt,
  });

  return res(
    {
      ok: true,
      sessionToken,
      sessionId: session.id,
      startedAt,
      durationMs: SESSION_DURATION_MS,
    },
    201,
  );
}
