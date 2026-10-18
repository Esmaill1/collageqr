import { NextResponse } from "next/server";
import { getWeeklyLeaderboard } from "@/lib/leaderboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const desks = await getWeeklyLeaderboard();
  return NextResponse.json({ ok: true, desks });
}
