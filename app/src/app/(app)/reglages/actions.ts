"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createBackup } from "@/lib/backup";
import { deleteSubscription, saveSubscription, sendPushToAll } from "@/lib/push";
import { SESSION_COOKIE } from "@/lib/session";

type SubscriptionInput = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function subscribePush(sub: SubscriptionInput) {
  await requireSession();
  const { endpoint, keys } = sub;
  if (!endpoint?.startsWith("https://") || !keys?.p256dh || !keys.auth) {
    throw new Error("Abonnement invalide");
  }
  const userAgent = (await headers()).get("user-agent") ?? undefined;
  saveSubscription({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, userAgent);
}

export async function unsubscribePush(endpoint: string) {
  await requireSession();
  deleteSubscription(endpoint);
}

export async function sendTestPush(): Promise<{ sent: number; error?: string }> {
  await requireSession();
  try {
    const sent = await sendPushToAll({
      title: "Hub",
      body: "Les notifications fonctionnent.",
      url: "/reglages",
    });
    return { sent };
  } catch (error) {
    return { sent: 0, error: (error as Error).message };
  }
}

export async function createBackupAction(): Promise<{ name: string; size: number } | { error: string }> {
  await requireSession();
  try {
    const b = await createBackup();
    return { name: b.name, size: b.size };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
