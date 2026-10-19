import { prisma } from "@/lib/db";
import { levelLabel } from "@/lib/desk";
import { FOCUS_MINUTES } from "@/lib/focus";

/**
 * Library leaderboard (PRD §3.4 P1): Top 10 most active desks THIS WEEK.
 *
 * A completed focus session is always a 10-minute session, so weekly
 * minutes = 10 × completed sessions in the last 7 days. Weakly-active
 * desks (0 weekly minutes) can still fill remaining slots, ranked by
 * all-time minutes, so a young library still shows a full board.
 */
export const SESSION_MINUTES = FOCUS_MINUTES;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const LIMIT = 10;
const POOL_SIZE = 40;

export interface LeaderboardRow {
  id: string;
  zoneName: string;
  level: number;
  levelLabel: string;
  weeklyMinutes: number;
  totalMinutes: number;
}

export async function getWeeklyLeaderboard(): Promise<LeaderboardRow[]> {
  const since = new Date(Date.now() - WEEK_MS);

  const [desks, weekly] = await Promise.all([
    prisma.desk.findMany({
      select: { id: true, zoneName: true, level: true, totalMinutes: true },
      orderBy: { totalMinutes: "desc" },
      take: POOL_SIZE,
    }),
    prisma.focusSession.groupBy({
      by: ["deskId"],
      where: { completedAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  const weeklyByDesk = new Map<string, number>();
  for (const row of weekly) {
    weeklyByDesk.set(row.deskId, row._count._all * SESSION_MINUTES);
  }

  return desks
    .map((desk) => ({
      id: desk.id,
      zoneName: desk.zoneName,
      level: desk.level,
      levelLabel: levelLabel(desk.level),
      weeklyMinutes: weeklyByDesk.get(desk.id) ?? 0,
      totalMinutes: desk.totalMinutes,
    }))
    .sort(
      (a, b) =>
        b.weeklyMinutes - a.weeklyMinutes || b.totalMinutes - a.totalMinutes,
    )
    .slice(0, LIMIT);
}
