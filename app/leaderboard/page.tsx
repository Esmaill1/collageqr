import Link from "next/link";
import { getWeeklyLeaderboard } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

/**
 * Library Leaderboard (PRD §3.4 P1): Top 10 most active desks this week.
 * Server Component — data shared with GET /api/leaderboard via
 * lib/leaderboard.ts, so no absolute-URL fetch gymnastics.
 */

const medals = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage() {
  const desks = await getWeeklyLeaderboard();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[480px] px-4 pb-16 pt-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
          🏆 ترتيب الترابيزات
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-muted)" }}>
          أكتر 10 ترابيزات نشاط بدقايق التركيز ده الأسبوع.
        </p>
      </header>

      {desks.length === 0 ? (
        <section className="card p-8 text-center">
          <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
            مفيش ترابيزات متسجلة لسه. خُدها عليك وامسح أول واحدة.
          </p>
          <Link href="/" className="btn btn-ghost mt-4">
            امسح ترابيزتك
          </Link>
        </section>
      ) : (
        <ol className="flex flex-col gap-3">
          {desks.map((desk, index) => {
            const podium = index < 3;
            return (
              <li
                key={desk.id}
                className="card flex items-center gap-3 p-4"
                style={
                  podium
                    ? { borderColor: "var(--accent)", boxShadow: "var(--shadow-lift)" }
                    : undefined
                }
              >
                <span
                  className="flex w-10 shrink-0 justify-center text-xl font-bold"
                  style={{ color: podium ? "var(--accent)" : "var(--ink-faint)" }}
                  aria-label={`مركز ${index + 1}`}
                >
                  {podium ? medals[index] : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold" style={{ color: "var(--ink)" }}>
                    ترابيزة {desk.id}
                    <span
                      className="ms-2 text-xs font-normal"
                      style={{ color: "var(--ink-muted)" }}
                    >
                      مستوى {desk.level} · {desk.levelLabel}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--ink-muted)" }}>
                    {desk.zoneName}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-sm font-bold" style={{ color: "var(--accent)" }}>
                    {desk.weeklyMinutes} دقيقة
                  </p>
                  <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                    ده الأسبوع · {desk.totalMinutes} إجمالي
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <footer className="mt-8">
        <Link
          href="/"
          className="btn btn-ghost btn-block"
          style={{ color: "var(--ink-muted)" }}
        >
          ← امسح ترابيزتك عشان تسجل وقت التركيز
        </Link>
      </footer>
    </main>
  );
}
