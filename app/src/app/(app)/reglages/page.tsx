import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { logout } from "./actions";
import { PushManager } from "./push-manager";

export const metadata: Metadata = { title: "Réglages" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function ReglagesPage() {
  const { username } = await requireSession();

  return (
    <>
      <PageHeader title="Réglages" />
      <div className="space-y-4">
        <Section title="Notifications">
          <PushManager publicKey={process.env.VAPID_PUBLIC_KEY || null} />
        </Section>
        <Section title="Compte">
          <p className="mb-3 text-sm text-muted">
            Connecté en tant que <b className="text-foreground">{username}</b>
          </p>
          <form action={logout}>
            <button type="submit" className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-danger">
              Se déconnecter
            </button>
          </form>
        </Section>
      </div>
    </>
  );
}
