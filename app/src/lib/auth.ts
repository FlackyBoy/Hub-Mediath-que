import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyPassword } from "./password";
import { SESSION_COOKIE, verifySessionToken, type Session } from "./session";

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

// À appeler dans chaque page, Server Action et route API protégée :
// le proxy ne suffit pas à lui seul.
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function checkCredentials(username: string, password: string): Promise<boolean> {
  const expectedUser = process.env.AUTH_USERNAME ?? "";
  const hash = process.env.AUTH_PASSWORD_HASH ?? "";
  if (!expectedUser || !hash) {
    throw new Error("AUTH_USERNAME ou AUTH_PASSWORD_HASH manquant dans .env");
  }

  const a = Buffer.from(username);
  const b = Buffer.from(expectedUser);
  const userOk = a.length === b.length && timingSafeEqual(a, b);
  const passwordOk = await verifyPassword(password, hash);
  return userOk && passwordOk;
}
