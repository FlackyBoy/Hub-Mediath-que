import type { Metadata } from "next";
import Link from "next/link";
import { DiskMeter } from "@/components/disk-charts";
import { ChevronRightIcon, FolderIcon, RefreshIcon } from "@/components/icons";
import { ComingSoon, PageHeader } from "@/components/page-header";
import { diskUsage, getScanInfo } from "@/lib/disk";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Médiathèque" };

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

export default async function MediathequePage() {
  const usage = await diskUsage();
  const scan = getScanInfo();

  return (
    <>
      <PageHeader title="Médiathèque" subtitle="Fichiers et téléchargements du serveur" />
      <div className="space-y-4">
        {usage && <DiskMeter {...usage} />}
        <NavCard
          href="/mediatheque/fichiers"
          title="Fichiers"
          text="Parcourir, renommer, supprimer"
          icon={<FolderIcon className="size-6" />}
        />
        <NavCard
          href="/mediatheque/espace"
          title="Espace disque"
          text={`Par dossier et par type · analyse ${formatRelative(scan.finishedAt)}`}
          icon={<RefreshIcon className="size-6" />}
        />
        <ComingSoon
          items={[
            "Recherche Prowlarr : films, séries, autres",
            "Envoi vers rTorrent et suivi des téléchargements",
            "Notification quand un téléchargement est terminé",
          ]}
        />
      </div>
    </>
  );
}
