/** Shared client-side sanity check for track URLs (lib/capsule is server-side). */
export function isValidHttpUrl(value: string): boolean {
  return /^https:\/\/\S+$/i.test(value);
}
