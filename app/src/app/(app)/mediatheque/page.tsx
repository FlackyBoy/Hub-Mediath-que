import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Médiathèque" };

export default function MediathequePage() {
  return (
    <>
      <PageHeader title="Médiathèque" subtitle="Fichiers et téléchargements du serveur" />
      <ComingSoon
        items={[
          "Explorateur de fichiers (aperçu, renommer, supprimer)",
          "Répartition de l'espace disque par dossier et par type",
          "Recherche Prowlarr : films, séries, autres",
          "Envoi vers rTorrent et suivi des téléchargements",
          "Notification quand un téléchargement est terminé",
        ]}
      />
    </>
  );
}
