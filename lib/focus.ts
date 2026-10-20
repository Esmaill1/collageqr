/**
 * Shared focus-session contract.
 *
 * The focus ritual is deliberately short enough for a first visit while
 * still creating a meaningful effort wall before someone can leave a note.
 */
export const FOCUS_DURATION_MS = 10 * 60 * 1000;
export const FOCUS_GRACE_MS = 30 * 1000;
export const MIN_FOCUS_MS = FOCUS_DURATION_MS - FOCUS_GRACE_MS;
export const FOCUS_MINUTES = FOCUS_DURATION_MS / (60 * 1000);

export const SIGNING_TOKEN_TTL_MS = 15 * 60 * 1000;
export const SIGNING_TOKEN_TTL = "15m" as const;
