import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { FOCUS_MINUTES, MIN_FOCUS_MS } from "@/lib/focus";
import { signSigningToken, verifySession } from "@/lib/jwt";
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
  // from null to non-null awards XP. If the client lost a successful response,
  // a later retry returns a fresh signing token without awarding XP twice.
  const transaction = await prisma.$transaction(async (tx) => {
    const completed = await tx.focusSession.updateMany({
      where: { id: session.id, completedAt: null },
      data: { completedAt },
    });
    if (completed.count !== 1) {
      const alreadyCompleted = await tx.focusSession.findUnique({
        where: { id: session.id },
      });
      if (!alreadyCompleted?.completedAt) return null;
      const desk = await tx.desk.findUniqueOrThrow({
        where: { id: session.deskId },
      });
      return { desk, alreadyCompleted: true };
    }

    const desk = await tx.desk.findUniqueOrThrow({
      where: { id: session.deskId },
    });

    const newTotalMinutes = desk.totalMinutes + XP_PER_SESSION;
    const newLevel = levelFromMinutes(newTotalMinutes);

    const updatedDesk = await tx.desk.update({
      where: { id: desk.id },
      data: { totalMinutes: { increment: XP_PER_SESSION }, level: newLevel },
    });

    return { desk: updatedDesk, alreadyCompleted: false };
  });

  if (!transaction) {
    return NextResponse.json(
      { error: "already-completed" },
      { status: 409 },
    );
  }

  const signingToken = signSigningToken({
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
