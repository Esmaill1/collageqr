/**
 * Canonical text normalization shared by server and client (PRD §4):
 *
 * Strip raw URLs from note text: https/http links and leading www. hosts.
 * URLs are unwelcome per PRD §4 — notes stay plain text only.
 *
 * The server capsule validator and the client composer (char counter,
 * canSubmit) must agree on this normalization, so both import this single
 * implementation instead of drifting local copies.
 */
export function stripUrls(text: string): string {
  return text
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/(^|\s)www\.\S+/gi, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
