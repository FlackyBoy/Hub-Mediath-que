import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/breadcrumb";
import { FileList } from "@/components/file-list";
import { getDirSizes } from "@/lib/disk";
import { fsErrorMessage, listDir, listRoots, type Entry } from "@/lib/files";
import { filesHref, formatBytes } from "@/lib/media-links";
import { parseSort, sortEntries, toViewEntries, type SortKey } from "@/lib/media-view";

export const metadata: Metadata = { title: "Fichiers" };

const SORTS: { key: SortKey; label: string }[] = [
  { key: "nom", label: "Nom" },
  { key: "taille", label: "Taille" },
  { key: "date", label: "Date" },
];

export default async function FichiersPage({ searchParams }: PageProps<"/fichiers">) {
  const params = await searchParams;
  const rel = typeof params.p === "string" ? params.p : "";
  const sort = parseSort(params.tri);

  let entries: Entry[] = [];
  let error: string | null = null;
  try {
    entries = rel ? await listDir(rel) : await listRoots();
  } catch (e) {
    error = fsErrorMessage(e);
  }
  const view = sortEntries(entries, toViewEntries(entries), sort);
  const total = rel ? getDirSizes([rel]).get(rel) : undefined;
  const title = rel ? rel.split("/").pop()! : "Fichiers";

  return (
    <>
      {rel && <Breadcrumb rel={rel} />}
      <header className="mb-4">
        <h1 className="break-all text-2xl font-bold tracking-tight">{title}</h1>
        {total && (
          <p className="mt-1 text-sm text-muted">
            {formatBytes(total.size)} · {total.files.toLocaleString("fr-FR")} fichiers
          </p>
        )}
      </header>

      {error ? (
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
          <p className="mb-2 text-danger">{error}</p>
          <Link href={filesHref("")} className="text-accent">
            Retour aux fichiers
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-3 flex gap-2" role="group" aria-label="Trier par">
            {SORTS.map((s) => (
              <Link
                key={s.key}
                href={`${filesHref(rel)}${rel ? "&" : "?"}tri=${s.key}`}
                replace
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  sort === s.key ? "bg-accent text-accent-foreground" : "border border-border text-muted"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
          <FileList entries={view} canEdit={Boolean(rel)} />
        </>
      )}
    </>
  );
}
