export function buildDeskUrl(deskId: string, origin?: string): string {
  const base = origin ?? defaultOrigin();
  return `${base.replace(/\/+$/, "")}/?desk=${encodeURIComponent(deskId)}`;
}

function defaultOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function defaultDeskIds(): string[] {
  return Array.from({ length: 30 }, (_, i) => `B${String(i + 1).padStart(2, "0")}`);
}

export function parseDeskList(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}
