import { NextResponse } from "next/server";
import { applyDeviceCookie, getDeviceContext } from "@/lib/device";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** PRD §4 Layer 3: 3 unique devices peel a note off the wall. */
const HIDE_THRESHOLD = 3;

/**
 * Rollback marker: the caller's device already reported this capsule
 * (reports.capsuleId_deviceHash_key → Prisma P2002). Thrown inside the
 * transaction so nothing else commits.
 */
class AlreadyReportedError extends Error {}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "P2002";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Cookie-based device identity (finding #7): one browser = one vote per
  // capsule. Rotating client headers no longer mints fresh identities.
  const device = await getDeviceContext();
  const res = (body: unknown, status: number) =>
    applyDeviceCookie(NextResponse.json(body, { status }), device);
  const deviceHash = device.deviceHash;

  const capsule = await prisma.capsule.findUnique({
    where: { id },
    select: { id: true, reportCount: true, status: true },
  });
  if (!capsule) {
    return res({ error: "not-found" }, 404);
  }

  if (capsule.status === "HIDDEN") {
    return res(
      {
        ok: true,
        reportCount: capsule.reportCount,
        status: capsule.status,
      },
      200,
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // (a) Dedup vote: P2002 → this device already peeled this note.
      try {
        await tx.report.create({
          data: { capsuleId: id, deviceHash },
        });
      } catch (error) {
        if (isUniqueViolation(error)) throw new AlreadyReportedError();
        throw error;
      }

      // (b) We have a fresh unique vote — bump the counter.
      const updated = await tx.capsule.update({
        where: { id },
        data: { reportCount: { increment: 1 } },
      });

      // (c) Threshold reached — hide, guarded so an already-hidden or
      // admin-flagged capsule outside PUBLISHED isn't touched.
      let status = updated.status;
      if (updated.reportCount >= HIDE_THRESHOLD) {
        const hidden = await tx.capsule.updateMany({
          where: { id, status: "PUBLISHED" },
          data: { status: "HIDDEN" },
        });
        if (hidden.count === 1) status = "HIDDEN";
      }

      return { reportCount: updated.reportCount, status };
    });

    return res(
      {
        ok: true,
        reportCount: result.reportCount,
        status: result.status,
      },
      200,
    );
  } catch (error) {
    if (error instanceof AlreadyReportedError) {
      return res({ error: "already-reported" }, 409);
    }
    return res({ error: "report-failed" }, 500);
  }
}
