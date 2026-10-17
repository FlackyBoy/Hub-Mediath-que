"use client";

import Link from "next/link";
import { useState } from "react";
import { DownloadIcon } from "@/components/icons";
import type { Category } from "@/lib/prowlarr";
import { DownloadDialog } from "./download-dialog";

export type ResultView = {
  id: string;
  title: string;
  category: Category;
  meta: string;
  detail: string;
  infoUrl: string | null;
  downloadUrl: string;
};

const TABS: { key: Category; label: string }[] = [
  { key: "films", label: "Films" },
  { key: "series", label: "Séries" },
  { key: "autres", label: "Autres" },
];

export function SearchResults({ results, defaults }: { results: ResultView[]; defaults: Record<Category, string> }) {
  const counts = Object.fromEntries(TABS.map((t) => [t.key, results.filter((r) => r.category === t.key).length]));
  const [tab, setTab] = useState<Category>(TABS.find((t) => counts[t.key] > 0)?.key ?? "films");
  const [chosen, setChosen] = useState<ResultView | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const visible = results.filter((r) => r.category === tab).slice(0, 60);

  if (results.length === 0) {
    return <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">Aucun résultat.</p>;
  }

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg py-2 text-sm font-medium ${tab === t.key ? "bg-accent text-accent-foreground" : "text-muted"}`}
          >
            {t.label} ({counts[t.key]})
          </button>
        ))}
      </div>

      {notice && (
        <p role="status" className="mb-3 rounded-xl border border-border bg-surface p-3 text-sm">
          {notice}{" "}
          <Link href="/mediatheque/telechargements" className="font-medium text-accent">
            Voir les téléchargements
          </Link>
        </p>
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">Rien dans cette catégorie.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {visible.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 break-all text-[15px]">{r.title}</p>
                <p className="truncate text-xs text-muted">{r.meta}</p>
              </div>
              <button
                aria-label={`Télécharger ${r.title}`}
                disabled={added.has(r.id)}
                onClick={() => setChosen(r)}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent disabled:bg-transparent disabled:text-muted"
              >
                {added.has(r.id) ? "✓" : <DownloadIcon className="size-5" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {chosen && (
        <DownloadDialog
          result={chosen}
          defaultDest={defaults[chosen.category]}
          onClose={() => setChosen(null)}
          onDone={(dest) => {
            setAdded((prev) => new Set(prev).add(chosen.id));
            setNotice(`Ajouté dans ${dest}.`);
            setChosen(null);
          }}
        />
      )}
    </div>
  );
}
