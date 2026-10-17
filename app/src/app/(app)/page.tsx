import Link from "next/link";
import { DiskMeter } from "@/components/disk-charts";
import { ChevronRightIcon, DownloadIcon, FolderIcon, RefreshIcon } from "@/components/icons";
import { InstallHint } from "@/components/install-hint";
import { PageHeader } from "@/components/page-header";
import { diskUsage, getScanInfo } from "@/lib/disk";
import { formatRelative } from "@/lib/format";
import { listTorrents } from "@/lib/rtorrent";

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("fr-FR", { hour: "numeric", timeZone: process.env.TZ || "Europe/Paris" }).format(new Date()),
  );
  return hour < 6 || hour >= 18 ? "Bonsoir" : "Bonjour";
}

function NavCard({ href, title, text, icon }: { href: string; title: string; text: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 active:scale-[0.99]">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted">{text}</span>
      </span>
      <ChevronRightIcon className="size-5 text-muted" />
    </Link>
  );
}

// Tableau de bord : état du serveur (espace, fichiers, téléchargements en cours).
export default async function DashboardPage() {
  const usage = await diskUsage();
  const scan = getScanInfo();
  const torrents = await listTorrents().catch(() => null);
  const active = torrents?.filter((t) => !t.complete).length ?? null;

  return (
    <>
      <PageHeader title={greeting()} subtitle="Tableau de bord du serveur" />
      <div className="space-y-4">
        <InstallHint />
        {usage && <DiskMeter {...usage} />}
        <NavCard
          href="/mediatheque"
          title="Téléchargements"
          text={
            active === null
              ? "rTorrent injoignable"
              : active === 0
                ? "Aucun en cours"
                : `${active} en cours`
          }
          icon={<DownloadIcon className="size-6" />}
        />
        <NavCard
          href="/espace"
          title="Espace disque"
          text={`Par dossier et par type · analyse ${formatRelative(scan.finishedAt)}`}
          icon={<RefreshIcon className="size-6" />}
        />
        <NavCard href="/fichiers" title="Fichiers" text="Parcourir, renommer, supprimer" icon={<FolderIcon className="size-6" />} />
      </div>
    </>
  );
}
