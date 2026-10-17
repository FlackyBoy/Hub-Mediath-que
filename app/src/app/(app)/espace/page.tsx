import type { Metadata } from "next";
import Link from "next/link";
import { BarList, DiskMeter } from "@/components/disk-charts";
import { FileList } from "@/components/file-list";
import { ScanButton } from "@/components/scan-button";
import { diskUsage, getCategoryFolders, getScanInfo, getTopFiles, getTypeBreakdown, isScanRunning } from "@/lib/disk";
import { KIND_LABELS } from "@/lib/files";
import { formatDate, formatRelative } from "@/lib/format";
import { filesHref, formatBytes, type ViewEntry } from "@/lib/media-links";

export const metadata: Metadata = { title: "Espace disque" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function EspacePage() {
  const usage = await diskUsage();
  const scan = getScanInfo();
  const running = isScanRunning();
  const types = getTypeBreakdown();
  const folders = getCategoryFolders();
  const top: ViewEntry[] = getTopFiles(20).map((f) => {
    const parts = f.rel.split("/");
    return {
      name: parts.at(-1)!,
      rel: f.rel,
      kind: f.kind,
      size: f.size,
      sizeLabel: formatBytes(f.size),
      dateLabel: formatDate(f.mtime),
      subtitle: `${formatBytes(f.size)} · ${parts.slice(0, -1).join("/")}`,
    };
  });
  const hasData = scan.status === "done" || types.length > 0;

  return (
    <>
      <nav className="mb-3 text-sm">
        <Link href="/" className="text-accent">
          Tableau de bord
        </Link>
      </nav>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Espace disque</h1>

      <div className="space-y-4">
        {usage && <DiskMeter {...usage} />}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
          <div className="text-sm">
            <p className="font-medium">
              {running ? "Analyse en cours…" : `Dernière analyse : ${formatRelative(scan.finishedAt)}`}
            </p>
            {scan.status === "done" && !running && (
              <p className="text-muted">
                {scan.files.toLocaleString("fr-FR")} fichiers · {formatBytes(scan.size)}
              </p>
            )}
            {scan.status === "error" && !running && <p className="text-danger">Échec : {scan.error}</p>}
          </div>
          <ScanButton running={running} label={hasData ? "Relancer" : "Analyser"} />
        </div>

        {!hasData && !running && (
          <p className="text-sm text-muted">Lance une première analyse pour voir la répartition de l&apos;espace.</p>
        )}

        {folders.length > 0 && (
          <Section title="Par dossier">
            <BarList
              caption="Taille par dossier"
              items={folders.map((f) => ({
                key: f.rel,
                label: f.rel,
                value: f.size,
                detail: `${f.files.toLocaleString("fr-FR")} fichiers`,
                href: filesHref(f.rel) + "&tri=taille",
              }))}
            />
          </Section>
        )}

        {types.length > 0 && (
          <Section title="Par type de fichier">
            <BarList
              caption="Taille par type de fichier"
              items={types.map((t) => ({
                key: t.kind,
                label: KIND_LABELS[t.kind],
                value: t.size,
                detail: `${t.files.toLocaleString("fr-FR")} fichiers`,
              }))}
            />
          </Section>
        )}

        {top.length > 0 && (
          <section>
            <h2 className="mb-2 font-semibold">Plus gros fichiers</h2>
            <FileList entries={top} />
          </section>
        )}
      </div>
    </>
  );
}
