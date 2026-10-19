import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { FOCUS_MINUTES, MIN_FOCUS_MS } from "@/lib/focus";
import { signSession, verifySession } from "@/lib/jwt";
import { levelFromMinutes, levelLabel } from "@/lib/desk";

const XP_PER_SESSION = FOCUS_MINUTES;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const { sessionToken } =
    body !== null && typeof body === "object"
      ? (body as { sessionToken?: unknown })
      : {};

  if (typeof sessionToken !== "string" || sessionToken.length === 0) {
    return NextResponse.json({ error: "missing-session-token" }, { status: 400 });
  }

  const payload = verifySession(sessionToken);
  if (!payload) {
    return NextResponse.json(
      { error: "invalid-or-expired-token" },
      { status: 401 },
    );
  }

  const session = await prisma.focusSession.findUnique({
    where: { id: payload.sessionId },
  });
  if (!session || session.deskId !== payload.deskId) {
    return NextResponse.json({ error: "session-not-found" }, { status: 404 });
  }

  const elapsedMs = Date.now() - session.startedAt.getTime();
  if (elapsedMs < MIN_FOCUS_MS) {
    return NextResponse.json(
      { error: "session-too-short", minFocusMs: MIN_FOCUS_MS },
      { status: 400 },
    );
  }

  const completedAt = new Date();
  // Atomic completion: only the request whose updateMany flips completedAt
  // from null to non-null (count === 1) awards XP. Concurrent/racing
  // completions count 0 and are rejected, preventing double-XP.
  const transaction = await prisma.$transaction(async (tx) => {
    const completed = await tx.focusSession.updateMany({
      where: { id: session.id, completedAt: null },
      data: { completedAt },
    });
    if (completed.count !== 1) return null;

    const desk = await tx.desk.findUniqueOrThrow({
      where: { id: session.deskId },
    });

    const newTotalMinutes = desk.totalMinutes + XP_PER_SESSION;
    const newLevel = levelFromMinutes(newTotalMinutes);

    const updatedDesk = await tx.desk.update({
      where: { id: desk.id },
      data: { totalMinutes: { increment: XP_PER_SESSION }, level: newLevel },
    });

    return { desk: updatedDesk };
  });

  if (!transaction) {
    return NextResponse.json(
      { error: "already-completed" },
      { status: 409 },
    );
  }

  const signingToken = signSession({
    deskId: transaction.desk.id,
    sessionId: session.id,
    startedAt: session.startedAt.getTime(),
  });

  return NextResponse.json(
    {
      ok: true,
      signingToken,
      completedAt,
      desk: {
        id: transaction.desk.id,
        totalMinutes: transaction.desk.totalMinutes,
        level: transaction.desk.level,
        levelLabel: levelLabel(transaction.desk.level),
      },
    },
    { status: 200 },
  );
}
