import { NextResponse } from "next/server";
import { serializeCapsule } from "@/lib/capsule";
import {
  applyDeviceCookie,
  getDeviceContext,
  type DeviceContext,
} from "@/lib/device";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Capsule fields safe to return to the claiming device. */
const CONTENT_SELECT = {
  id: true,
  deskId: true,
  type: true,
  authorAlias: true,
  textContent: true,
  doodleData: true,
  trackUrl: true,
  trackMetadata: true,
  isSealed: true,
  isOpened: true,
  openedByDeviceHash: true,
  reportCount: true,
  status: true,
  deviceHash: true,
  passParentId: true,
  createdAt: true,
} as const;

/*
 * Sealed-envelope lifecycle (PRD §3.3 P1), all gated by the caller's
 * deviceHash differing from the capsule author's deviceHash:
 *
 *   PATCH { action: "open" } → atomic isOpened false→true flip (guarded
 *     updateMany + count check, so two devices scanning simultaneously
 *     cannot both claim — Plan §6 race mitigation). Returns the content
 *     of the envelope ONLY on the successful flip.
 *   PATCH { action: "pin" }  → isSealed=false so the envelope joins the
 *     published feed ("Pin to Public Wall"). Requires the capsule to have
 *     been atomically opened first — an unopened sealed envelope cannot
 *     be pinned.
 *   DELETE                   → remove the capsule ("Keep Secret"). Also
 *     requires isOpened first, so the claimer's secret cannot be deleted
 *     by a drive-by scanner before they open it.
 *
 * Neither pin nor delete ever returns the envelope's secret content or
 * the author's deviceHash.
 */

async function loadCapsule(id: string) {
  return prisma.capsule.findUnique({
    where: { id },
    select: { ...CONTENT_SELECT },
  });
}

function unauthorized(
  reason: "not-sealed" | "own-envelope" | "not-opener",
  device: DeviceContext,
) {
  return applyDeviceCookie(
    NextResponse.json(
      { error: reason },
      { status: reason === "own-envelope" || reason === "not-opener" ? 403 : 400 },
    ),
    device,
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  const action =
    body === null || typeof body !== "object"
      ? null
      : (body as { action?: unknown }).action;

  if (action !== "open" && action !== "pin") {
    return res({ error: "invalid-request" }, 400);
  }

  const capsule = await loadCapsule(id);
  if (!capsule) {
    return res({ error: "not-found" }, 404);
  }

  const callerDeviceHash = device.deviceHash;

  if (!capsule.isSealed) return unauthorized("not-sealed", device);
  if (capsule.deviceHash === callerDeviceHash) {
    return unauthorized("own-envelope", device);
  }

  if (action === "open") {
    // Atomic claim: the guarded updateMany guarantees at most one winner.
    const claimed = await prisma.capsule.updateMany({
      where: { id, isSealed: true, isOpened: false },
      data: { isOpened: true, openedByDeviceHash: callerDeviceHash },
    });
    if (claimed.count !== 1) {
      return res({ error: "already-opened" }, 409);
    }
    const updated = await loadCapsule(id);
    return res({ ok: true, capsule: updated ? serializeCapsule(updated) : null }, 200);
  }

  // action === "pin" → unseal so the envelope joins the public feed.
  // The envelope must have been atomically opened first: pinning an
  // unopened sealed envelope would bypass the claim ritual entirely.
  if (!capsule.isOpened) {
    return res({ error: "not-opened" }, 409);
  }
  if (capsule.openedByDeviceHash !== callerDeviceHash) {
    return unauthorized("not-opener", device);
  }
  const pinned = await prisma.capsule.updateMany({
    where: {
      id,
      isSealed: true,
      isOpened: true,
      openedByDeviceHash: callerDeviceHash,
    },
    data: { isSealed: false },
  });
  if (pinned.count !== 1) {
    // Lost a race with another device's pin/open between load and update:
    // re-read and report the state the caller actually lost against.
    const current = await loadCapsule(id);
    if (current && !current.isOpened) {
      return res({ error: "not-opened" }, 409);
    }
    return unauthorized("not-sealed", device);
  }
  // The client already saw the secret content during the open step, so
  // the pin response is a bare acknowledgement — no content, no deviceHash.
  return res({ ok: true, id }, 200);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const device = await getDeviceContext();
  const res = (body: unknown, status: number) =>
    applyDeviceCookie(NextResponse.json(body, { status }), device);

  const capsule = await loadCapsule(id);
  if (!capsule) {
    return res({ error: "not-found" }, 404);
  }

  const callerDeviceHash = device.deviceHash;

  if (!capsule.isSealed) return unauthorized("not-sealed", device);
  if (capsule.deviceHash === callerDeviceHash) {
    return unauthorized("own-envelope", device);
  }
  // A sealed envelope may only be deleted by the device that opened it.
  // Without this guard, any non-author scanner could destroy an unopened
  // secret the claimer never saw.
  if (!capsule.isOpened) {
    return res({ error: "not-opened" }, 409);
  }
  if (capsule.openedByDeviceHash !== callerDeviceHash) {
    return unauthorized("not-opener", device);
  }

  // Clear reports first so the delete works even before the schema's
  // onDelete:Cascade for Report.capsuleId is migrated in (FK RESTRICT).
  await prisma.$transaction([
    prisma.report.deleteMany({ where: { capsuleId: id } }),
    prisma.capsule.delete({ where: { id } }),
  ]);
  return res({ ok: true }, 200);
}
