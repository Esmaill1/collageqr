import { NextResponse } from "next/server";

/** Pass-the-doodle is intentionally deferred beyond the text-only pilot. */
export function POST() {
  return NextResponse.json(
    { error: "pilot-feature-disabled", feature: "pass-doodle" },
    { status: 410 },
  );
}
