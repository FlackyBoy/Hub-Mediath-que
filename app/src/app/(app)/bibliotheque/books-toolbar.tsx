"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchIcon } from "@/components/icons";
import { btn, Modal } from "@/components/modal";
import { SORT_LABELS, STATUS_LABELS, TYPE_LABELS, type BookSort } from "@/lib/book-labels";

export type ToolbarParams = {
  q: string;
  type: string;
  statut: string;
  style: string;
  note: string;
  auteur: string;
  editeur: string;
  tri: BookSort;
  vue: "liste" | "grille";
};

export function booksHref(p: Partial<ToolbarParams>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) sp.set(k, String(v));
  const s = sp.toString();
  return s ? `/bibliotheque?${s}` : "/bibliotheque";
}

const selectClass = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base";

export function BooksToolbar({
  params,
  styles,
  authors,
  publishers,
}: {
  params: ToolbarParams;
  styles: string[];
  authors: string[];
  publishers: string[];
}) {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draft, setDraft] = useState(params);

  const go = (patch: Partial<ToolbarParams>) => router.replace(booksHref({ ...params, ...patch }));

  function setView(vue: ToolbarParams["vue"]) {
    document.cookie = `hub_books_view=${vue}; path=/; max-age=31536000; samesite=lax`;
    go({ vue });
  }

  // Filtres actifs affichés en pastilles supprimables
  const chips: { label: string; clear: Partial<ToolbarParams> }[] = [];
  if (params.statut) chips.push({ label: STATUS_LABELS[params.statut as keyof typeof STATUS_LABELS] ?? params.statut, clear: { statut: "" } });
  if (params.style) chips.push({ label: params.style, clear: { style: "" } });
  if (params.note) chips.push({ label: `Note ≥ ${params.note}`, clear: { note: "" } });
  if (params.auteur) chips.push({ label: params.auteur, clear: { auteur: "" } });
  if (params.editeur) chips.push({ label: params.editeur, clear: { editeur: "" } });

  return (
    <div className="mb-4 space-y-3">
      <form action="/bibliotheque" className="flex gap-2">
        {Object.entries(params).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <input
          name="q"
          type="search"
          defaultValue={params.q}
          placeholder="Titre, auteur, style…"
          enterKeyHint="search"
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-base outline-none focus:border-accent"
        />
        <button aria-label="Rechercher" className="rounded-xl bg-accent px-3.5 text-accent-foreground">
          <SearchIcon className="size-5" />
        </button>
      </form>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Type">
        {[["", "Tous"], ...Object.entries(TYPE_LABELS)].map(([key, label]) => (
          <Link
            key={key}
            href={booksHref({ ...params, type: key })}
            replace
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              params.type === key ? "bg-accent text-accent-foreground" : "border border-border text-muted"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setDraft(params);
            setFiltersOpen(true);
          }}
          className="rounded-xl border border-border px-3 py-2 text-sm font-medium"
        >
          Filtres{chips.length ? ` (${chips.length})` : ""}
        </button>
        <select
          aria-label="Trier par"
          value={params.tri}
          onChange={(e) => go({ tri: e.target.value as BookSort })}
          className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
        >
          {Object.entries(SORT_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              Tri : {label}
            </option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-xl border border-border text-sm" role="group" aria-label="Affichage">
          <button onClick={() => setView("liste")} aria-pressed={params.vue === "liste"} className={`px-3 py-2 ${params.vue === "liste" ? "bg-accent text-accent-foreground" : ""}`}>
            Liste
          </button>
          <button onClick={() => setView("grille")} aria-pressed={params.vue === "grille"} className={`px-3 py-2 ${params.vue === "grille" ? "bg-accent text-accent-foreground" : ""}`}>
            Couv.
          </button>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <Link key={c.label} href={booksHref({ ...params, ...c.clear })} replace className="rounded-full bg-accent/15 px-3 py-1 text-sm text-accent">
              {c.label} ✕
            </Link>
          ))}
        </div>
      )}

      {filtersOpen && (
        <Modal title="Filtres" onClose={() => setFiltersOpen(false)}>
          <div className="space-y-3">
            <label className="block text-sm">
              Statut
              <select className={selectClass} value={draft.statut} onChange={(e) => setDraft({ ...draft, statut: e.target.value })}>
                <option value="">Tous</option>
                {Object.entries(STATUS_LABELS).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Note minimale
              <select className={selectClass} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })}>
                <option value="">Toutes</option>
                {[5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>{n} et plus</option>
                ))}
              </select>
            </label>
            {[
              ["style", "Style", styles],
              ["auteur", "Auteur", authors],
              ["editeur", "Éditeur", publishers],
            ].map(([key, label, values]) => (
              <label key={key as string} className="block text-sm">
                {label as string}
                <select
                  className={selectClass}
                  value={draft[key as "style" | "auteur" | "editeur"]}
                  onChange={(e) => setDraft({ ...draft, [key as string]: e.target.value })}
                >
                  <option value="">Tous</option>
                  {(values as string[]).map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button className={btn.ghost} onClick={() => setDraft({ ...draft, statut: "", note: "", style: "", auteur: "", editeur: "" })}>
                Effacer
              </button>
              <button
                className={btn.primary}
                onClick={() => {
                  setFiltersOpen(false);
                  router.replace(booksHref(draft));
                }}
              >
                Appliquer
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
