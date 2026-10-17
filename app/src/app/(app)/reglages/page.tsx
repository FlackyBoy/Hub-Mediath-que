import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireSession } from "@/lib/auth";
import { lastBackupError, listBackups } from "@/lib/backup";
import { formatRelative } from "@/lib/format";
import { Backups } from "./backups";
import { isPlexConfigured, lastPlexSync } from "@/lib/plex";
import { isTmdbConfigured } from "@/lib/tmdb";
import { logout } from "./actions";
import { PlexSyncButton } from "./plex-sync";
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
  const plexStatus = lastPlexSync();
  const backups = await listBackups();

  return (
    <>
      <nav className="mb-3 text-sm">
        <Link href="/" className="text-accent">Tableau de bord</Link>
      </nav>
      <PageHeader title="Réglages" />
      <div className="space-y-4">
        <Section title="Notifications">
          <PushManager publicKey={process.env.VAPID_PUBLIC_KEY || null} />
        </Section>
        <Section title="Sauvegardes">
          <Backups
            error={lastBackupError()}
            backups={backups.map((b) => ({
              name: b.name,
              size: b.size,
              label: new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.TZ || "Europe/Paris" }).format(new Date(b.createdAt)),
            }))}
          />
        </Section>
        <Section title="Plex">
          {isPlexConfigured() ? (
            <>
              <p className="mb-3 text-sm text-muted">
                Les films et séries vus dans Plex passent en « Vu » (ou « En cours ») dans Écrans, toutes les 6 heures.
                {plexStatus && ("error" in plexStatus
                  ? ` Dernière tentative : échec (${plexStatus.error}).`
                  : ` Dernière synchro : ${formatRelative(plexStatus.at.replace("T", " ").slice(0, 19))}, ${plexStatus.items} titres.`)}
              </p>
              <PlexSyncButton />
            </>
          ) : (
            <p className="text-sm text-muted">Non configuré : il manque PLEX_TOKEN (commande : bash deploy/set-plex-token.sh).</p>
          )}
        </Section>
        <Section title="Films et séries (TMDB)">
          <p className="text-sm text-muted">{isTmdbConfigured() ? "Connecté." : "Non configuré : il manque TMDB_API_KEY (commande : bash deploy/set-tmdb-key.sh)."}</p>
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
