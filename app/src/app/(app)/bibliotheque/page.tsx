import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Bibliothèque" };

export default function BibliothequePage() {
  return (
    <>
      <PageHeader title="Bibliothèque" subtitle="Livres et BD" />
      <ComingSoon
        items={[
          "Import du tracker Google Sheets (CSV)",
          "Fiches avec couverture via Open Library / Google Books",
          "Ajout par scan ISBN avec la caméra",
          "Filtres : auteur, éditeur, note, statut, style",
        ]}
      />
    </>
  );
}
