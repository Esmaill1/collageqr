import { NextResponse } from "next/server";

/** Public competition is intentionally deferred beyond the first pilot. */
export function GET() {
  return NextResponse.json(
    { error: "pilot-feature-disabled", feature: "leaderboard" },
    { status: 410 },
  );
}
