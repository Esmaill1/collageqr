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
    <header className="card mb-6" style={{ padding: "var(--space-6)" }}>
      <h1
        className="font-bold"
        style={{ color: "var(--ink)", fontSize: "var(--text-2xl)", lineHeight: 1.25 }}
      >
        ترابيزة {desk.id}
      </h1>
      <p
        className="mt-1"
        style={{ color: "var(--ink-muted)", fontSize: "var(--text-sm)" }}
      >
        {desk.zoneName}
      </p>

      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2"
        style={{ marginTop: "var(--space-6)" }}
      >
        <span
          title={`المستوى ${desk.level}`}
          style={{ color: "var(--ink)", fontSize: "var(--text-base)" }}
        >
          <span style={{ color: "var(--accent)", fontWeight: 700 }}>
            مستوى {desk.level}
          </span>{" "}
          <span style={{ color: "var(--ink-muted)" }}>{levelLabel(desk.level)}</span>
        </span>
        <span className="pill" style={{ color: "var(--ink-muted)" }}>
          {hours} ساعة مسجّلة
        </span>
      </div>

      {tags.length > 0 && (
        <ul
          className="flex flex-wrap gap-2"
          style={{ marginTop: "var(--space-6)" }}
        >
          {tags.map((tag) => (
            <li
              key={tag.key}
              className="pill"
              style={{ color: "var(--ink)" }}
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
