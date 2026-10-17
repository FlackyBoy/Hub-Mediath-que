import type { Metadata } from "next";
import Link from "next/link";
import { enrichmentProgress } from "@/lib/book-enrich";
import { CoverProgress, ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Importer des livres" };

export default function ImporterPage() {
  const progress = enrichmentProgress();
  return (
    <>
      <nav className="mb-3 text-sm">
        <Link href="/bibliotheque" className="text-accent">Livres</Link>
      </nav>
      <h1 className="mb-2 text-2xl font-bold tracking-tight">Importer</h1>
      <p className="mb-4 text-sm text-muted">
        Dans Google Sheets : Fichier &gt; Télécharger &gt; Valeurs séparées par des virgules (.csv). Les colonnes sont reconnues par
        leur titre (Nom du livre, Auteur, Appréciation, Lu / Non lu, Style, Résumé, Pourquoi j&apos;aimerais…). Un livre déjà présent
        est mis à jour, pas dupliqué.
      </p>
      <div className="space-y-4">
        <ImportForm />
        <CoverProgress {...progress} />
      </div>
    </>
  );
}
