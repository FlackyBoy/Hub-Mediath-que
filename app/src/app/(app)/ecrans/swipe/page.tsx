import type { Metadata } from "next";
import Link from "next/link";
import { isTmdbConfigured } from "@/lib/tmdb";
import { SwipeDeck } from "./swipe-deck";

export const metadata: Metadata = { title: "Swipe" };

export default function SwipePage() {
  return (
    <>
      <nav className="mb-3 text-sm">
        <Link href="/ecrans" className="text-accent">Écrans</Link>
      </nav>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Swipe</h1>
      {isTmdbConfigured() ? (
        <SwipeDeck />
      ) : (
        <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          TMDB n&apos;est pas encore configuré : il manque TMDB_API_KEY sur le serveur.
        </p>
      )}
    </>
  );
}
