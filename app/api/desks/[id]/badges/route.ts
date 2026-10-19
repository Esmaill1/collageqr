import { NextResponse } from "next/server";

/** Physical desk badges are intentionally deferred beyond the pilot. */
export function POST() {
  return NextResponse.json(
    { error: "pilot-feature-disabled", feature: "desk-badges" },
    { status: 410 },
  );
}
