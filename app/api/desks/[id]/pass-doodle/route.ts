import { NextResponse } from "next/server";
import { getPendingPassDoodle } from "@/lib/feed";

export const dynamic = "force-dynamic";

/**
 * Pass-the-Doodle intake (PRD §3.3 P2, Plan §5 Wave 6).
 *
 * GET /api/desks/[id]/pass-doodle
 *
 * Returns the newest PENDING parent pass-doodle for the desk (the half-doodle
 * the composer offers the next occupant to finish):
 *   { pending: { id, doodleData } } when one is waiting
 *   { pending: null }               when the desk has no open half-doodle
 * A parent counts as pending only while NO child capsule exists
 * (passParentId=parent.id); once continued, it vanishes from this feed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const pending = await getPendingPassDoodle(id);

  return NextResponse.json({
    pending: pending ? { id: pending.id, doodleData: pending.doodleData } : null,
  });
}
