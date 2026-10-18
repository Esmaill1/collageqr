import { NextResponse } from "next/server";
import { createCapsule, type CapsuleError } from "@/lib/capsule";
import { applyDeviceCookie, getDeviceContext } from "@/lib/device";

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

  if ( typeof body !== "object" || body === null) {
    return res({ error: "invalid-request" }, 400);
  }
  const { sessionToken, textContent, doodleData, authorAlias, trackUrl, isSealed, isPassDoodle } =
    body as {
      sessionToken?: unknown;
      textContent?: unknown;
      doodleData?: unknown;
      authorAlias?: unknown;
      trackUrl?: unknown;
      isSealed?: unknown;
      isPassDoodle?: unknown;
    };

  if (typeof sessionToken !== "string" || sessionToken.length === 0) {
    return res({ error: "invalid-token" }, 401);
  }

  const result = await createCapsule({
    sessionToken,
    textContent: typeof textContent === "string" ? textContent : undefined,
    doodleData: typeof doodleData === "string" ? doodleData : undefined,
    authorAlias: typeof authorAlias === "string" ? authorAlias : undefined,
    trackUrl: typeof trackUrl === "string" ? trackUrl : undefined,
    isSealed: isSealed === true ? true : undefined,
    isPassDoodle: isPassDoodle === true ? true : undefined,
    deviceHash: device.deviceHash,
  });

  if (!result.ok) {
    return res({ error: result.error }, HTTP_STATUS[result.error]);
  }

  return res({ ok: true, capsule: result.capsule }, 201);
}
