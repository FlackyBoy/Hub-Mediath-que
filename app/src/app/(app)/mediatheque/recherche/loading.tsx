import { RefreshIcon } from "@/components/icons";

// Affiché pendant la recherche Prowlarr (jusqu'à une minute), surtout en arrivant par le
// bouton « Télécharger » d'une fiche Écrans : sans ça, rien ne bouge à l'écran
export default function Loading() {
  return (
    <>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Recherche</h1>
      <p role="status" className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
        <RefreshIcon className="size-5 animate-spin" />
        Recherche des propositions… (jusqu&apos;à une minute)
      </p>
    </>
  );
}
