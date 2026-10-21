import type { Metadata } from "next";
import Link from "next/link";
import { SheetSync } from "@/components/sheet-sync";
import { gameEnrichmentProgress } from "@/lib/game-enrich";
import { sheetStatus } from "@/lib/sheet-sync";
import { GameImportForm, MetaProgress } from "./import-form";

export const metadata: Metadata = { title: "Importer des jeux" };

export default function ImporterJeuxPage() {
  const progress = gameEnrichmentProgress();
  return (
    <>
      <nav className="mb-3 text-sm"><Link href="/jeux" className="text-accent">Jeux</Link></nav>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Importer et synchroniser</h1>
      <div className="mb-4">
        <SheetSync target="games" status={sheetStatus("games")} noun={["jeu", "jeux"]} />
      </div>
      <div className="mb-4 space-y-2 text-sm text-muted">
        <p>
          Ou avec un fichier : dans Google Sheets, Fichier &gt; Télécharger &gt; Valeurs séparées par des virgules (.csv). Seule la colonne <b>Nom</b> (ou
          « Jeu ») est obligatoire. Colonnes reconnues en plus : Note, Avis, Statut, Parties, Joueurs (« 2-4 »), Durée (« 45 min »),
          Année, Éditeur, BGG (lien ou identifiant BoardGameGeek, pour éviter toute erreur de jeu).
        </p>
        <p>
          Statut : « Envie » ou « Non » = liste d&apos;envies, « Vendu » / « Donné » = plus à moi, sinon dans la ludothèque. Un jeu
          déjà présent est mis à jour, pas dupliqué.
        </p>
      </div>
      <div className="space-y-4">
        <GameImportForm />
        <MetaProgress {...progress} />
      </div>
    </>
  );
}
