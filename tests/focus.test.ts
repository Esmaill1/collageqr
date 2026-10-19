import assert from "node:assert/strict";
import test from "node:test";
import {
  FOCUS_DURATION_MS,
  FOCUS_GRACE_MS,
  FOCUS_MINUTES,
  MIN_FOCUS_MS,
} from "../lib/focus";

test("the pilot focus ritual is ten minutes with a thirty-second grace window", () => {
  assert.equal(FOCUS_DURATION_MS, 10 * 60 * 1000);
  assert.equal(FOCUS_GRACE_MS, 30 * 1000);
  assert.equal(MIN_FOCUS_MS, 9 * 60 * 1000 + 30 * 1000);
  assert.equal(FOCUS_MINUTES, 10);
});
