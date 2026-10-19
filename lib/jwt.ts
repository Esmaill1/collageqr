import jwt from "jsonwebtoken";
import { SIGNING_TOKEN_TTL } from "@/lib/focus";

export interface SessionPayload {
  deskId: string;
  sessionId: string;
  startedAt: number;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, getSecret(), {
    algorithm: "HS256",
    expiresIn: SIGNING_TOKEN_TTL,
  });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret(), { algorithms: ["HS256"] });
    if (typeof decoded === "string") return null;
    const { deskId, sessionId, startedAt } = decoded as jwt.JwtPayload &
      SessionPayload;
    if (typeof deskId !== "string" || typeof sessionId !== "string" || typeof startedAt !== "number") {
      return null;
    }
    return { deskId, sessionId, startedAt };
  } catch {
    return null;
  }
}
