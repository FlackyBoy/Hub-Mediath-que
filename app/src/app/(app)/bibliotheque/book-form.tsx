"use client";

import Link from "next/link";
import { useState } from "react";
import { btn } from "@/components/modal";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/book-labels";
import { createBookAction, updateBookAction, type SaveResult } from "./actions";

export type BookFormValues = {
  title: string;
  author: string;
  rating: string;
  status: string;
  type: string;
  style: string;
  publisher: string;
  year: string;
  pages: string;
  isbn: string;
  summary: string;
  pros: string;
  cons: string;
  notes: string;
};

export const EMPTY_BOOK: BookFormValues = {
  title: "", author: "", rating: "", status: "a_lire", type: "roman", style: "", publisher: "",
  year: "", pages: "", isbn: "", summary: "", pros: "", cons: "", notes: "",
};

const input = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-accent";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
    </label>
  );
}

// Formulaire commun : création (avec couverture d'un candidat éventuelle) ou modification
export function BookForm({
  initial,
  bookId,
  coverUrl,
  styles,
}: {
  initial: BookFormValues;
  bookId?: number;
  coverUrl?: string | null;
  styles: string[];
}) {
  const [v, setV] = useState(initial);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const set = (k: keyof BookFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setResult(null);
    // En cas de succès, l'action redirige vers la fiche
    const res = bookId ? await updateBookAction(bookId, v) : await createBookAction(v, coverUrl);
    setPending(false);
    setResult(res);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Titre *">
        <input className={input} value={v.title} onChange={set("title")} required />
      </Field>
      <Field label="Auteur">
        <input className={input} value={v.author} onChange={set("author")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select className={input} value={v.type} onChange={set("type")}>
            {Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Statut">
          <select className={input} value={v.status} onChange={set("status")}>
            {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Note /10">
          <select className={input} value={v.rating} onChange={set("rating")}>
            <option value="">Pas de note</option>
            {Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
        <Field label="Style">
          <input className={input} value={v.style} onChange={set("style")} list="styles" placeholder="Polar, SF…" />
          <datalist id="styles">{styles.map((s) => <option key={s} value={s} />)}</datalist>
        </Field>
        <Field label="Éditeur">
          <input className={input} value={v.publisher} onChange={set("publisher")} />
        </Field>
        <Field label="Année">
          <input className={input} value={v.year} onChange={set("year")} inputMode="numeric" />
        </Field>
        <Field label="Pages">
          <input className={input} value={v.pages} onChange={set("pages")} inputMode="numeric" />
        </Field>
        <Field label="ISBN">
          <input className={input} value={v.isbn} onChange={set("isbn")} inputMode="numeric" />
        </Field>
      </div>
      <Field label="Résumé sans spoil">
        <textarea className={input} rows={3} value={v.summary} onChange={set("summary")} />
      </Field>
      <Field label="Pourquoi j'aimerais">
        <textarea className={input} rows={2} value={v.pros} onChange={set("pros")} />
      </Field>
      <Field label="Pourquoi je n'aimerais pas">
        <textarea className={input} rows={2} value={v.cons} onChange={set("cons")} />
      </Field>
      <Field label="Mon avis">
        <textarea className={input} rows={4} value={v.notes} onChange={set("notes")} placeholder="Ce que j'en ai pensé…" />
      </Field>

      {result && !result.ok && (
        <p className="text-sm text-danger">
          {result.error}{" "}
          {result.duplicateId && (
            <Link href={`/bibliotheque/${result.duplicateId}`} className="font-medium text-accent">Voir la fiche</Link>
          )}
        </p>
      )}
      <button type="submit" className={`${btn.primary} w-full`} disabled={pending || !v.title.trim()}>
        {pending ? "Enregistrement…" : bookId ? "Enregistrer" : "Ajouter à ma bibliothèque"}
      </button>
    </form>
  );
}
