import { createHash, randomUUID } from "crypto";
import { cookies, headers } from "next/headers";

/**
 * Cookie-based device identity (finding #7).
 *
 * The device UUID is SERVER-generated and persisted in an httpOnly cookie
 * (`dl_device`). The previously client-controlled device UUID header is
 * gone — a client can no longer rotate its identity between requests, so
 * the 3-unique-device peel-off threshold, sealed-envelope claiming, own-
 * envelope refusal, and badge-vote dedup all stay keyed on one stable
 * identity per browser.
 *
 * Mint-on-read: when the cookie is absent, a UUID is minted and its hash
 * is used for THIS request while the cookie is set on the response, so the
 * NEXT request reuses the same UUID and therefore the same hash — identity
 * is stable from the very first POST onward.
 */

export const DEVICE_COOKIE_NAME = "dl_device";

export const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Minimal accessor surface for cookie and header sources: next/headers'
 * awaited `cookies()` and `headers()` stores satisfy both directly.
 */
export interface DeviceCookieStore {
  get(name: string): { value: string } | undefined;
}

export interface DeviceHeaderStore {
  get(name: string): string | null;
}

/** Result of the pure hash computation. */
export interface DeviceHashResult {
  hash: string;
  /** Present only when a fresh UUID was minted (cookie was absent). */
  newCookie?: string;
}

/** What API route handlers consume. */
export interface DeviceContext {
  deviceHash: string;
  /** Present when a UUID was minted this request; set it on the response. */
  setDeviceCookie?: string;
}

function callerIp(requestHeaders: DeviceHeaderStore): string {
  return (requestHeaders.get("x-forwarded-for") ?? "")
    .split(",")[0]
    .trim();
}

/** Stable browser identity: network changes must not create a new device. */
export function deviceHashFor(_ip: string, uuid: string): string {
  return createHash("sha256")
    .update(`device|${uuid}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Pure version: compute the device hash from the cookie store, minting a
 * fresh UUID when the cookie is absent (returned in `newCookie` so the
 * caller can set it on the response). The request headers remain part of the
 * function signature because the anonymous SSR fallback still uses the IP.
 */
export function getDeviceHashFromCookies(
  cookieStore: DeviceCookieStore,
  _requestHeaders: DeviceHeaderStore,
): DeviceHashResult {
  void _requestHeaders;
  const uuid = cookieStore.get(DEVICE_COOKIE_NAME)?.value;
  if (uuid) {
    return { hash: deviceHashFor("", uuid) };
  }
  // Mint-on-read: the minted UUID hashes to THIS request's identity and
  // is persisted via the response cookie for every future request.
  const minted = randomUUID();
  return { hash: deviceHashFor("", minted), newCookie: minted };
}

/**
 * Anonymous stand-in hash for cookie-less visitors (SSR path — Server
 * Components can read but not set cookies). Salted differently so it can
 * never collide with a real identity; such a visitor has no established
 * identity and cannot claim anything.
 */
export function getAnonymousDeviceHash(
  requestHeaders: DeviceHeaderStore,
): string {
  return createHash("sha256")
    .update(`anon|${callerIp(requestHeaders)}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Async cookie-based device context for API route handlers. Reads the
 * `dl_device` cookie (minting one when absent) and the caller's IP. When
 * `setDeviceCookie` is present, apply it to every returned NextResponse
 * via `applyDeviceCookie` so the identity persists.
 */
export async function getDeviceContext(): Promise<DeviceContext> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const { hash, newCookie } = getDeviceHashFromCookies(
    cookieStore,
    requestHeaders,
  );
  return newCookie !== undefined
    ? { deviceHash: hash, setDeviceCookie: newCookie }
    : { deviceHash: hash };
}

/**
 * Apply the minted device cookie to a response, if one was minted this
 * request. Safe to call unconditionally on every response; returns the
 * same response for chaining.
 */
export function applyDeviceCookie<
  ResponseT extends {
    cookies: {
      set: (
        options: {
          name: string;
          value: string;
          httpOnly: boolean;
          sameSite: "lax";
          secure: boolean;
          path: string;
          maxAge: number;
        },
      ) => void;
    };
  },
>(response: ResponseT, device: { setDeviceCookie?: string }): ResponseT {
  if (device.setDeviceCookie !== undefined) {
    response.cookies.set({
      name: DEVICE_COOKIE_NAME,
      value: device.setDeviceCookie,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE,
    });
  }
  return response;
}
