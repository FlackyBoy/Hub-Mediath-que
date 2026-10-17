// Exécuté une fois au démarrage du serveur : lance la surveillance des téléchargements.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDownloadWatcher } = await import("./lib/downloads");
    startDownloadWatcher();
  }
}
