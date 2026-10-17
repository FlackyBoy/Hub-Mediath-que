"use client";

import { useEffect } from "react";

// Fenêtre modale : feuille en bas d'écran sur mobile, centrée sur grand écran.
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button aria-label="Fermer" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl border border-border bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:rounded-3xl sm:pb-5">
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export const btn = {
  primary: "rounded-xl bg-accent px-4 py-3 font-semibold text-accent-foreground disabled:opacity-60",
  danger: "rounded-xl bg-danger px-4 py-3 font-semibold text-white disabled:opacity-60",
  ghost: "rounded-xl border border-border px-4 py-3 font-semibold disabled:opacity-60",
};
