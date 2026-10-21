// Exécuté une fois au démarrage du serveur : surveillance des téléchargements,
// synchronisation périodique de Plex, sauvegarde quotidienne et reprise de
// l'enrichissement des livres (couvertures, résumés) et des jeux (fiches BGG),
// analyse périodique des dossiers de livres numériques.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDownloadWatcher } = await import("./lib/downloads");
    startDownloadWatcher();
    const { startPlexSchedule } = await import("./lib/plex");
    startPlexSchedule();
    const { startBackupSchedule } = await import("./lib/backup");
    startBackupSchedule();
    const { startEnrichment } = await import("./lib/book-enrich");
    startEnrichment();
    const { startGameEnrichment } = await import("./lib/game-enrich");
    startGameEnrichment();
    const { startBookScanSchedule } = await import("./lib/book-files");
    startBookScanSchedule();
  }
}
