// Exécuté une fois au démarrage du serveur : surveillance des téléchargements,
// synchronisation périodique de Plex et sauvegarde quotidienne.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDownloadWatcher } = await import("./lib/downloads");
    startDownloadWatcher();
    const { startPlexSchedule } = await import("./lib/plex");
    startPlexSchedule();
    const { startBackupSchedule } = await import("./lib/backup");
    startBackupSchedule();
  }
}
