"use client";

import Link from "next/link";

// Bascule affiches / liste, mémorisée dans un cookie
export function ScreensViewToggle({ vue, hrefListe, hrefGrille }: { vue: string; hrefListe: string; hrefGrille: string }) {
  const remember = (v: string) => {
    document.cookie = `hub_screens_view=${v}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <div className="ml-auto flex overflow-hidden rounded-xl border border-border text-sm">
      <Link href={hrefGrille} replace onClick={() => remember("grille")} className={`px-3 py-2 ${vue === "grille" ? "bg-accent text-accent-foreground" : ""}`}>Affiches</Link>
      <Link href={hrefListe} replace onClick={() => remember("liste")} className={`px-3 py-2 ${vue === "liste" ? "bg-accent text-accent-foreground" : ""}`}>Liste</Link>
    </div>
  );
}
