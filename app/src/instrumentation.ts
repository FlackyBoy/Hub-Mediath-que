// Exécuté une fois au démarrage du serveur : surveillance des téléchargements
// et synchronisation périodique de Plex.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDownloadWatcher } = await import("./lib/downloads");
    startDownloadWatcher();
    const { startPlexSchedule } = await import("./lib/plex");
    startPlexSchedule();
  }
}
