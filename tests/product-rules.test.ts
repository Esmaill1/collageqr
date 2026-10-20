import assert from "node:assert/strict";
import test from "node:test";
import { getDeskPrompt } from "../lib/prompts";
import { hasDeferredCapsuleFields } from "../lib/pilot";
import { isValidDeskId, parseDeskList } from "../lib/sticker";
import { deviceHashFor } from "../lib/device";
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

test("sticker desk IDs are normalized and limited to the pilot desks", () => {
  assert.equal(isValidDeskId("B01"), true);
  assert.equal(isValidDeskId("B30"), true);
  assert.equal(isValidDeskId("B00"), false);
  assert.equal(isValidDeskId("B31"), false);
  assert.deepEqual(parseDeskList("b14, B14\nB02"), ["B14", "B02"]);
});

test("device identity survives an IP address change", () => {
  assert.equal(deviceHashFor("198.51.100.10", "device-1"), deviceHashFor("203.0.113.8", "device-1"));
  assert.notEqual(deviceHashFor("198.51.100.10", "device-1"), deviceHashFor("198.51.100.10", "device-2"));
});
