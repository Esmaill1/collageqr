import { NextResponse } from "next/server";

/** Pass-the-doodle is intentionally deferred beyond the text-only pilot. */
export function GET() {
  return NextResponse.json(
    { error: "pilot-feature-disabled", feature: "pass-doodle" },
    { status: 410 },
  );
}
