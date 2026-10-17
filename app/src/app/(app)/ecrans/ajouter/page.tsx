import type { Metadata } from "next";
import Link from "next/link";
import { isTmdbConfigured } from "@/lib/tmdb";
import { AddScreen } from "./add-screen";

export const metadata: Metadata = { title: "Ajouter un film ou une série" };

export default function AjouterEcranPage() {
  return (
    <>
      <nav className="mb-3 text-sm"><Link href="/ecrans" className="text-accent">Écrans</Link></nav>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Ajouter</h1>
      {isTmdbConfigured() ? <AddScreen /> : (
        <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">TMDB n&apos;est pas encore configuré (TMDB_API_KEY).</p>
      )}
    </>
  );
}
