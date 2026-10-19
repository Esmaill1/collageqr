import { NextResponse } from "next/server";
import { createCapsule, type CapsuleError } from "@/lib/capsule";
import { applyDeviceCookie, getDeviceContext } from "@/lib/device";
import { hasDeferredCapsuleFields } from "@/lib/pilot";

export const dynamic = "force-dynamic";

const HTTP_STATUS: Record<CapsuleError, number> = {
  "invalid-request": 400,
  "empty-capsule": 400,
  "text-too-long": 400,
  "doodle-too-large": 400,
  "alias-too-long": 400,
  "invalid-token": 401,
  "session-not-completed": 403,
  "session-not-found": 404,
  "token-used": 409,
};

export async function POST(request: Request) {
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
  const {
    sessionToken,
    textContent,
    authorAlias,
    isSealed,
    doodleData,
    trackUrl,
    isPassDoodle,
  } =
    body as {
      sessionToken?: unknown;
      textContent?: unknown;
      authorAlias?: unknown;
      isSealed?: unknown;
      doodleData?: unknown;
      trackUrl?: unknown;
      isPassDoodle?: unknown;
    };

  if (typeof sessionToken !== "string" || sessionToken.length === 0) {
    return res({ error: "invalid-token" }, 401);
  }

  // The pilot deliberately accepts only text and sealed text notes. Keep the
  // future fields in the database, but do not let a caller bypass the reduced
  // UI and publish deferred formats directly.
  if (hasDeferredCapsuleFields({ doodleData, trackUrl, isPassDoodle })) {
    return res({ error: "invalid-request" }, 400);
  }

  const result = await createCapsule({
    sessionToken,
    textContent: typeof textContent === "string" ? textContent : undefined,
    authorAlias: typeof authorAlias === "string" ? authorAlias : undefined,
    isSealed: isSealed === true ? true : undefined,
    deviceHash: device.deviceHash,
  });

  if (!result.ok) {
    return res({ error: result.error }, HTTP_STATUS[result.error]);
  }

  return res({ ok: true, capsule: result.capsule }, 201);
}
