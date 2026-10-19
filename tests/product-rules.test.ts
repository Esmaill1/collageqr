import assert from "node:assert/strict";
import test from "node:test";
import { getDeskPrompt } from "../lib/prompts";
import { hasDeferredCapsuleFields } from "../lib/pilot";
import {
  NOTE_MAX_CHARS,
  normalizeNoteText,
  noteTextError,
} from "../lib/text";

test("desk prompts are stable for the same physical desk", () => {
  assert.equal(getDeskPrompt("B14"), getDeskPrompt("B14"));
  assert.notEqual(getDeskPrompt("B14"), undefined);
});

test("note normalization removes links before validating content", () => {
  assert.equal(
    normalizeNoteText("شد حيلك https://example.com وخد نفس"),
    "شد حيلك وخد نفس",
  );
  assert.equal(noteTextError(""), "empty");
  assert.equal(noteTextError("a".repeat(NOTE_MAX_CHARS)), null);
  assert.equal(noteTextError("a".repeat(NOTE_MAX_CHARS + 1)), "too-long");
});

test("the pilot rejects deferred artifact payloads", () => {
  assert.equal(hasDeferredCapsuleFields({}), false);
  assert.equal(hasDeferredCapsuleFields({ doodleData: "anything" }), true);
  assert.equal(hasDeferredCapsuleFields({ trackUrl: null }), true);
  assert.equal(hasDeferredCapsuleFields({ isPassDoodle: false }), true);
});
