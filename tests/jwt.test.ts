import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import {
  signSession,
  signSigningToken,
} from "../lib/jwt";

process.env.JWT_SECRET = "desk-lore-test-secret";

const payload = { deskId: "B14", sessionId: "session-1", startedAt: Date.now() };

test("focus session tokens outlive the ten-minute ritual", () => {
  const token = jwt.decode(signSession(payload)) as { iat: number; exp: number };
  assert.ok(token.exp - token.iat >= 24 * 60 * 60 - 2);
});

test("signing tokens expire after the short writing window", () => {
  const token = jwt.decode(signSigningToken(payload)) as { iat: number; exp: number };
  assert.ok(token.exp - token.iat >= 15 * 60 - 2);
  assert.ok(token.exp - token.iat <= 15 * 60 + 2);
});
