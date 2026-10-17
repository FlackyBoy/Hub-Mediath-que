"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { btn } from "@/components/modal";
import type { ImportResult } from "@/lib/book-import";
import { importCsvAction, startEnrichmentAction } from "../actions";

export function ImportForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResult | { error: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setPending(true);
    const form = new FormData();
    form.set("csv", file);
    setResult(await importCsvAction(form));
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className={`${btn.ghost} block text-center`}>
        {file ? file.name : "Choisir le fichier CSV"}
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <button className={`${btn.primary} w-full`} disabled={!file || pending}>
        {pending ? "Import en cours…" : "Importer"}
      </button>
      {result && "error" in result && <p className="text-sm text-danger">{result.error}</p>}
      {result && !("error" in result) && (
        <div className="rounded-xl border border-border bg-surface p-3 text-sm">
          <p className="font-medium">
            {result.created} livre{result.created > 1 ? "s" : ""} ajouté{result.created > 1 ? "s" : ""}, {result.updated} mis à jour
            {result.skipped > 0 && `, ${result.skipped} ligne(s) vide(s) ignorée(s)`}.
          </p>
          {result.unknownColumns.length > 0 && <p className="mt-1 text-muted">Colonnes ignorées : {result.unknownColumns.join(", ")}</p>}
          {result.errors.length > 0 && <p className="mt-1 text-danger">{result.errors.slice(0, 5).join(" ; ")}</p>}
        </div>
      )}
    </form>
  );
}

// Progression de la recherche des couvertures, rafraîchie tant qu'elle tourne
export function CoverProgress({ running, pending, ok, doubtful, missing }: { running: boolean; pending: number; ok: number; doubtful: number; missing: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => startTransition(() => router.refresh()), 3000);
    return () => clearInterval(id);
  }, [running, router]);

  const total = pending + ok + doubtful + missing;
  if (total === 0) return null;
  const done = total - pending;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
      <p className="mb-2 font-medium">Couvertures et infos : {done} / {total}</p>
      <div className="mb-2 h-2 overflow-hidden rounded-full bg-accent/15">
        <div className="h-full rounded-r-full bg-accent" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <p className="text-muted">
        {ok} trouvées · {doubtful} à vérifier · {missing} sans couverture{pending > 0 && ` · ${pending} en attente`}
      </p>
      {!running && pending > 0 && (
        <button className="mt-2 font-medium text-accent" onClick={async () => { await startEnrichmentAction(); router.refresh(); }}>
          Reprendre la recherche
        </button>
      )}
    </div>
  );
}
