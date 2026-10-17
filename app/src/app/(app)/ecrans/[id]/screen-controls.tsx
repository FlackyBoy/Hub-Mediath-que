"use client";

import { useRef, useState } from "react";
import { TrashIcon } from "@/components/icons";
import { btn, Modal } from "@/components/modal";
import { SCREEN_STATUS_LABELS, type ScreenStatus } from "@/lib/screen-labels";
import { deleteScreenAction, quickUpdateScreenAction } from "../actions";

export function ScreenStatusPicker({ id, value }: { id: number; value: ScreenStatus }) {
  const [status, setStatus] = useState(value);
  return (
    <div className="grid grid-cols-5 gap-1 rounded-xl border border-border bg-surface p-1" role="radiogroup" aria-label="Statut">
      {(Object.entries(SCREEN_STATUS_LABELS) as [ScreenStatus, string][]).map(([k, label]) => (
        <button key={k} role="radio" aria-checked={status === k}
          onClick={async () => { setStatus(k); await quickUpdateScreenAction(id, { status: k }); }}
          className={`rounded-lg px-0.5 py-2 text-[11px] font-medium leading-tight ${status === k ? "bg-accent text-accent-foreground" : "text-muted"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function ScreenRatingPicker({ id, value }: { id: number; value: number | null }) {
  const [rating, setRating] = useState(value);
  async function pick(n: number) {
    const next = rating === n ? null : n;
    setRating(next);
    await quickUpdateScreenAction(id, { rating: next });
  }
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">Ma note {rating !== null ? `: ${rating}/10` : ""}</p>
      <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label="Note sur 10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button key={n} role="radio" aria-checked={rating === n} onClick={() => pick(n)}
            className={`rounded-lg py-2 text-sm font-semibold ${rating !== null && n <= rating ? "bg-accent text-accent-foreground" : "bg-accent/10 text-muted"}`}>
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ScreenNotes({ id, value }: { id: number; value: string }) {
  const [notes, setNotes] = useState(value);
  const [state, setState] = useState<"" | "…" | "Enregistré">("");
  const last = useRef(value);
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="font-medium">Mon avis</span>
        <span className="text-xs text-muted">{state}</span>
      </div>
      <textarea value={notes} rows={4} placeholder="Ce que j'en ai pensé…"
        onChange={(e) => { setNotes(e.target.value); setState(""); }}
        onBlur={async () => {
          if (notes === last.current) return;
          setState("…");
          await quickUpdateScreenAction(id, { notes });
          last.current = notes;
          setState("Enregistré");
        }}
        className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-accent" />
    </div>
  );
}

export function DeleteScreen({ id, title }: { id: number; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-sm font-medium text-danger">
        <TrashIcon className="size-5" /> Retirer de ma liste
      </button>
      {open && (
        <Modal title="Retirer ce titre ?" onClose={() => setOpen(false)}>
          <p className="mb-5 text-sm">« {title} » sera retiré, avec ta note et ton avis.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className={btn.ghost} onClick={() => setOpen(false)}>Annuler</button>
            <button className={btn.danger} onClick={() => deleteScreenAction(id)}>Retirer</button>
          </div>
        </Modal>
      )}
    </>
  );
}
