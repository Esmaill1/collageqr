const DESK_PROMPTS = [
  "إيه اللي شغال عليه النهارده؟",
  "إيه حاجة صغيرة ساعدتك تركز؟",
  "سيب جملة للي هيقعد هنا بعدك.",
  "إيه أهم حاجة عايز تخلصها قبل ما تقوم؟",
  "لو الترابيزة دي تقدر تدي نصيحة، هتقول إيه؟",
  "احكي لحظة صغيرة حصلتلك هنا.",
] as const;

/** Pick a stable prompt so the same desk keeps its own little question. */
export function getDeskPrompt(deskId: string): string {
  let hash = 0;
  for (let i = 0; i < deskId.length; i += 1) {
    hash = (hash * 31 + deskId.charCodeAt(i)) | 0;
  }
  return DESK_PROMPTS[Math.abs(hash) % DESK_PROMPTS.length];
}

export { DESK_PROMPTS };
