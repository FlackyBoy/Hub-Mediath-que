import webpush from "web-push";
import { getDb } from "./db";

export type PushPayload = { title: string; body: string; url?: string };

type StoredSubscription = { endpoint: string; p256dh: string; auth: string };

let configured = false;

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  if (configured) return;
  if (!isPushConfigured()) {
    throw new Error("Notifications non configurées : VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY manquants");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@localhost",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export function saveSubscription(sub: StoredSubscription, userAgent?: string) {
  getDb()
    .prepare(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent) VALUES (?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth,
       user_agent = excluded.user_agent`,
    )
    .run(sub.endpoint, sub.p256dh, sub.auth, userAgent ?? null);
}

export function deleteSubscription(endpoint: string) {
  getDb().prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(endpoint);
}

// Envoie à tous les appareils abonnés. Les abonnements expirés sont supprimés.
export async function sendPushToAll(payload: PushPayload): Promise<number> {
  configure();
  const subs = getDb()
    .prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions")
    .all() as StoredSubscription[];

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) deleteSubscription(s.endpoint);
        else console.error("Échec de la notification push", status, error);
      }
    }),
  );
  return sent;
}
