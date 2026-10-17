export { formatBytes } from "./media-links";

export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: process.env.TZ || "Europe/Paris",
  }).format(new Date(ms));
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "jamais";
  const ms = Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}
