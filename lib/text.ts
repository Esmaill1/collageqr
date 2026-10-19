export const NOTE_MAX_CHARS = 160;

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

export function normalizeNoteText(text: string): string {
  return stripUrls(text);
}

export function noteTextError(text: string): "empty" | "too-long" | null {
  const normalized = normalizeNoteText(text);
  if (normalized.length === 0) return "empty";
  if (normalized.length > NOTE_MAX_CHARS) return "too-long";
  return null;
}
