import assert from "node:assert/strict";
import test from "node:test";
import { FALLBACK_POOL, SEALED_POOL } from "../lib/llm-seed";

test("checked-in seed messages fit the text-note contract", () => {
  assert.ok(FALLBACK_POOL.length >= 30);
  assert.ok(SEALED_POOL.length > 0);

  for (const note of FALLBACK_POOL) {
    assert.ok(note.text.length > 0 && note.text.length <= 160);
    assert.ok(note.alias.length > 0 && note.alias.length <= 40);
    assert.doesNotMatch(note.text, /https?:\/\/|www\./i);
  }

  for (const message of SEALED_POOL) {
    assert.ok(message.length > 0 && message.length <= 160);
    assert.doesNotMatch(message, /https?:\/\/|www\./i);
  }
});
