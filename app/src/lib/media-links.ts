// Utilitaires sans dépendance serveur, utilisables dans les composants client.
import type { EntryKind } from "./files";

export type ViewEntry = {
  name: string;
  rel: string;
  kind: EntryKind;
  size: number | null;
  sizeLabel: string | null;
  dateLabel: string;
  subtitle?: string;
};

export function filesHref(rel: string): string {
  return rel ? `/fichiers?p=${encodeURIComponent(rel)}` : "/fichiers";
}

export function previewHref(rel: string): string {
  return `/fichiers/apercu?p=${encodeURIComponent(rel)}`;
}

export function rawHref(rel: string, download = false): string {
  return `/api/files/raw?p=${encodeURIComponent(rel)}${download ? "&dl=1" : ""}`;
}

const UNITS = ["o", "Ko", "Mo", "Go", "To", "Po"];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 o";
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exp;
  const digits = exp === 0 || value >= 100 ? 0 : 1;
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: digits })} ${UNITS[exp]}`;
}
