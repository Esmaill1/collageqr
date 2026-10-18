export interface BadgeDef {
  key: string;
  label: string;
  emoji: string;
}

export const BADGES: BadgeDef[] = [
  { key: "outlet",  emoji: "⚡",  label: "فكّة شغّالة" },
  { key: "cold_ac", emoji: "🥶", label: "تكييف بيرجّع" },
  { key: "sunny",   emoji: "☀️", label: "نور طبيعي كويس" },
  { key: "squeaky", emoji: "🪑", label: "كرسي بياخر" },
  { key: "wobbly",  emoji: "↕️", label: "ترابيزة بتترجّح" },
  { key: "quiet",   emoji: "🤫", label: "ساكت خالص" },
];

export const BADGE_KEYS: string[] = BADGES.map((b) => b.key);

export function badgeLabel(key: string): string {
  return BADGES.find((b) => b.key === key)?.label ?? key;
}

export function badgeEmoji(key: string): string {
  return BADGES.find((b) => b.key === key)?.emoji ?? "";
}
