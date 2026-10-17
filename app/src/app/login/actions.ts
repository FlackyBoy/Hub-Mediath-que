"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkCredentials } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export type LoginState = { error?: string } | undefined;

// Anti force brute : 5 échecs consécutifs bloquent la connexion 15 minutes.
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
let failures = 0;
let lockedUntil = 0;

// N'accepte que des chemins internes pour éviter les redirections ouvertes.
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const now = Date.now();
  if (lockedUntil > now) {
    const minutes = Math.ceil((lockedUntil - now) / 60000);
    return { error: `Trop de tentatives. Réessaie dans ${minutes} min.` };
  }

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  let ok: boolean;
  try {
    ok = await checkCredentials(username, password);
  } catch (error) {
    console.error(error);
    return { error: "Configuration incomplète sur le serveur (voir les logs)." };
  }

  if (!ok) {
    failures++;
    if (failures >= MAX_FAILURES) {
      failures = 0;
      lockedUntil = now + LOCK_MS;
    }
    return { error: "Identifiant ou mot de passe incorrect." };
  }

  failures = 0;
  (await cookies()).set(SESSION_COOKIE, createSessionToken(username), sessionCookieOptions);
  redirect(safeNext(formData.get("next")));
}
