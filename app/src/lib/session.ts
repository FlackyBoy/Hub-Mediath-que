import { createHmac, timingSafeEqual } from "node:crypto";

// Session sans état : cookie signé HMAC contenant l'utilisateur et l'expiration.
// Changer SESSION_SECRET déconnecte tous les appareils.

export const SESSION_COOKIE = "hub_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 jours

export type Session = { username: string };

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET manquant ou trop court (32 caractères minimum)");
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(username: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const payload = Buffer.from(JSON.stringify({ u: username, exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof u !== "string" || typeof exp !== "number") return null;
    if (exp < Date.now() / 1000) return null;
    if (u !== process.env.AUTH_USERNAME) return null;
    return { username: u };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
