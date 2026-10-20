export function buildDeskUrl(deskId: string, origin?: string): string {
  const base = origin ?? defaultOrigin();
  return `${base.replace(/\/+$/, "")}/?desk=${encodeURIComponent(deskId)}`;
}

function defaultOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("NEXT_PUBLIC_APP_URL is required to print production stickers");
}

export const DESK_ID_PATTERN = /^B(?:0[1-9]|[12][0-9]|30)$/;

export function isValidDeskId(id: string): boolean {
  return DESK_ID_PATTERN.test(id.trim().toUpperCase());
}

export function defaultDeskIds(): string[] {
  return Array.from({ length: 30 }, (_, i) => `B${String(i + 1).padStart(2, "0")}`);
}

export function parseDeskList(input: string): string[] {
  return Array.from(new Set(input
    .split(/[\s,]+/)
    .map((id) => id.trim().toUpperCase())
    .filter((id) => id.length > 0)));
}
