import { levelLabel } from "@/lib/desk";
import { badgeLabel, badgeEmoji } from "@/lib/badges";

function friendlyTagLabel(key: string): string {
  const emoji = badgeEmoji(key);
  const label = badgeLabel(key);
  return emoji ? `${emoji} ${label}` : label;
}

function topTags(tagCounts: unknown): { key: string; count: number }[] {
  if (!tagCounts || typeof tagCounts !== "object" || Array.isArray(tagCounts)) {
    return [];
  }
  return Object.entries(tagCounts as Record<string, unknown>)
    .filter(([, v]) => typeof v === "number")
    .map(([key, count]) => ({ key, count: count as number }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

export default function DeskHeader({
  desk,
}: {
  desk: {
    id: string;
    zoneName: string;
    totalMinutes: number;
    level: number;
    tagCounts: unknown;
  };
}) {
  const hours = (desk.totalMinutes / 60).toFixed(1);
  const tags = topTags(desk.tagCounts);

  return (
    <header
      className="mb-5 rounded-lg border p-4"
      style={{ borderColor: "var(--grid-line)" }}
    >
      <h1 className="text-2xl font-bold text-ink">ترابيزة {desk.id}</h1>
      <p className="mt-1 text-sm text-ink opacity-70">{desk.zoneName}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink">
        <span title={`المستوى ${desk.level}`}>
          <span className="font-semibold text-accent">مستوى {desk.level}</span>{" "}
          {levelLabel(desk.level)}
        </span>
        <span className="opacity-70">{hours} ساعة مسجّلة</span>
      </div>

      {tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li
              key={tag.key}
              className="rounded-full border px-2.5 py-1 text-xs text-ink"
              style={{ borderColor: "var(--grid-line)" }}
              title={`${tag.count} تقييم`}
            >
              {friendlyTagLabel(tag.key)}
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
