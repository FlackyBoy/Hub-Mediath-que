"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PencilIcon, RefreshIcon, TrashIcon } from "@/components/icons";
import { btn, Modal } from "@/components/modal";
import { STATUS_LABELS, type BookStatus } from "@/lib/book-labels";
import type { BookCandidate } from "@/lib/book-meta";
import {
  coverCandidatesAction,
  deleteBookAction,
  quickUpdateAction,
  setCoverFromUrlAction,
  uploadCoverAction,
} from "../actions";

// Note de 1 à 10 en un toucher ; toucher la note actuelle l'efface
export function RatingPicker({ id, value }: { id: number; value: number | null }) {
  const [rating, setRating] = useState(value);
  async function pick(n: number) {
    const next = rating === n ? null : n;
    setRating(next);
    await quickUpdateAction(id, { rating: next });
  }
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">Ma note {rating !== null ? `: ${rating}/10` : ""}</p>
      <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label="Note sur 10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={rating === n}
            onClick={() => pick(n)}
            className={`rounded-lg py-2 text-sm font-semibold ${rating !== null && n <= rating ? "bg-accent text-accent-foreground" : "bg-accent/10 text-muted"}`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StatusPicker({ id, value }: { id: number; value: BookStatus }) {
  const [status, setStatus] = useState(value);
  return (
    <div className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-surface p-1" role="radiogroup" aria-label="Statut">
      {(Object.entries(STATUS_LABELS) as [BookStatus, string][]).map(([k, label]) => (
        <button
          key={k}
          role="radio"
          aria-checked={status === k}
          onClick={async () => {
            setStatus(k);
            await quickUpdateAction(id, { status: k });
          }}
          className={`rounded-lg py-2 text-xs font-medium ${status === k ? "bg-accent text-accent-foreground" : "text-muted"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// « Mon avis » : enregistré automatiquement quand on quitte le champ
export function NotesEditor({ id, value }: { id: number; value: string }) {
  const [notes, setNotes] = useState(value);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const last = useRef(value);
  async function save() {
    if (notes === last.current) return;
    setSaved("saving");
    await quickUpdateAction(id, { notes });
    last.current = notes;
    setSaved("saved");
  }
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium">Mon avis</span>
        <span className="text-xs text-muted">{saved === "saving" ? "Enregistrement…" : saved === "saved" ? "Enregistré" : ""}</span>
      </div>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved("idle");
        }}
        onBlur={save}
        rows={4}
        placeholder="Ce que j'en ai pensé, ce qui m'a plu ou pas…"
        className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-accent"
      />
    </div>
  );
}

export function BookActions({ id, title }: { id: number; title: string }) {
  const router = useRouter();
  const [coverOpen, setCoverOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [candidates, setCandidates] = useState<BookCandidate[] | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openCover() {
    setCoverOpen(true);
    setError(null);
    setCandidates(null);
    setCandidates(await coverCandidatesAction(id));
  }

  async function done(res: { ok: boolean; error?: string }) {
    setBusy(false);
    if (res.ok) {
      setCoverOpen(false);
      router.refresh();
    } else setError(res.error ?? "Échec");
  }

  const cls = "flex flex-1 flex-col items-center gap-1 rounded-2xl border border-border bg-surface py-3 text-sm font-medium";
  return (
    <>
      <div className="flex gap-2">
        <Link href={`/bibliotheque/${id}/modifier`} className={cls}>
          <PencilIcon className="size-5" /> Modifier
        </Link>
        <button className={cls} onClick={openCover}>
          <RefreshIcon className="size-5" /> Couverture
        </button>
        <button className={`${cls} text-danger`} onClick={() => setDeleting(true)}>
          <TrashIcon className="size-5" /> Supprimer
        </button>
      </div>

      {coverOpen && (
        <Modal title="Changer la couverture" onClose={() => setCoverOpen(false)}>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto">
            <div>
              <p className="mb-2 text-sm font-medium">Couvertures trouvées</p>
              {candidates === null ? (
                <p className="text-sm text-muted">Recherche…</p>
              ) : candidates.length === 0 ? (
                <p className="text-sm text-muted">Aucune couverture trouvée automatiquement.</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {candidates.map((c, i) => (
                    <button
                      key={i}
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        await done(await setCoverFromUrlAction(id, c.coverUrl!));
                      }}
                      title={`${c.title} · ${c.publisher || c.source}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.coverUrl!} alt={c.title} loading="lazy" className="aspect-[2/3] w-full rounded object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                await done(await setCoverFromUrlAction(id, url));
              }}
            >
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Ou colle l'adresse d'une image"
                type="url"
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-base"
              />
              <button className="rounded-xl bg-accent px-3 text-sm font-semibold text-accent-foreground" disabled={busy || !url}>OK</button>
            </form>
            <label className={`${btn.ghost} block text-center`}>
              Prendre une photo ou choisir une image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setBusy(true);
                  const form = new FormData();
                  form.set("cover", file);
                  await done(await uploadCoverAction(id, form));
                }}
              />
            </label>
            {busy && <p className="text-sm text-muted">Enregistrement…</p>}
            {error && <p className="text-sm text-danger">{error}</p>}
          </div>
        </Modal>
      )}

      {deleting && (
        <Modal title="Supprimer ce livre ?" onClose={() => setDeleting(false)}>
          <p className="mb-5 text-sm">« {title} » sera retiré de ta bibliothèque, avec ta note et ton avis.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className={btn.ghost} onClick={() => setDeleting(false)}>Annuler</button>
            <button className={btn.danger} onClick={() => deleteBookAction(id)}>Supprimer</button>
          </div>
        </Modal>
      )}
    </>
  );
}
