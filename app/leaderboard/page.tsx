import Link from "next/link";
import { getWeeklyLeaderboard } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

/**
 * Library Leaderboard (PRD §3.4 P1): Top 10 most active desks this week.
 * Server Component — data shared with GET /api/leaderboard via
 * lib/leaderboard.ts, so no absolute-URL fetch gymnastics.
 */
export default async function LeaderboardPage() {
  const desks = await getWeeklyLeaderboard();

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[480px] px-4 pb-16 pt-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-ink">
          🏆 Library Leaderboard
        </h1>
        <p className="mt-1 text-sm text-ink opacity-70">
          Top 10 desks by focus minutes this week.
        </p>
      </header>

      {desks.length === 0 ? (
        <section
          className="rounded-lg border p-6 text-center text-sm text-ink opacity-70"
          style={{ borderColor: "var(--grid-line)" }}
        >
          No desks registered yet. Be the first to scan one.
        </section>
      ) : (
        <ol className="flex flex-col gap-3">
          {desks.map((desk, index) => (
            <li
              key={desk.id}
              className="flex items-center rounded-lg border p-4"
              style={{ borderColor: "var(--grid-line)" }}
            >
              <span
                className={
                  index < 3
                    ? "w-9 text-lg font-bold text-accent"
                    : "w-9 text-lg font-bold text-ink opacity-50"
                }
              >
                {index + 1}
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold text-ink">
                  Desk {desk.id}
                  <span className="ml-2 text-xs font-normal text-ink opacity-60">
                    Lvl {desk.level} · {desk.levelLabel}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-ink opacity-60">
                  {desk.zoneName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-accent">
                  {desk.weeklyMinutes} min
                </p>
                <p className="text-[10px] text-ink opacity-50">
                  this week · {desk.totalMinutes} total
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}

      <footer className="mt-6 text-center">
        <Link
          href="/"
          className="text-xs text-ink underline opacity-70 hover:opacity-100"
        >
          ← Scan your desk to log focus time
        </Link>
      </footer>
    </main>
  );
}
