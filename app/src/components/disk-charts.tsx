import Link from "next/link";
import { formatBytes } from "@/lib/media-links";
import { AlertIcon } from "./icons";

// Jauge d'occupation : la couleur porte la gravité, toujours doublée d'une icône et d'un libellé.
const SEVERITY = {
  ok: { fill: "var(--accent)", label: null },
  warning: { fill: "#fab219", label: "Espace bientôt plein" },
  critical: { fill: "#d03b3b", label: "Disque presque plein" },
};

export function DiskMeter({ used, total, free }: { used: number; total: number; free: number }) {
  const ratio = total > 0 ? used / total : 0;
  const level = ratio >= 0.95 ? "critical" : ratio >= 0.85 ? "warning" : "ok";
  const { fill, label } = SEVERITY[level];
  const pct = Math.round(ratio * 100);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm text-muted">Espace libre</p>
      <p className="text-4xl font-semibold tracking-tight">{formatBytes(free)}</p>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Disque utilisé à ${pct} %`}
        className="mt-3 h-2.5 overflow-hidden rounded-full"
        style={{ background: `color-mix(in oklab, ${fill} 18%, transparent)` }}
      >
        <div className="h-full rounded-r-full" style={{ width: `${Math.min(100, ratio * 100)}%`, background: fill }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-muted">
          {formatBytes(used)} utilisés sur {formatBytes(total)} ({pct} %)
        </span>
      </div>
      {label && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium">
          <span style={{ color: fill }}>
            <AlertIcon className="size-4" />
          </span>
          {label}
        </p>
      )}
    </div>
  );
}

export type BarItem = { key: string; label: string; value: number; detail?: string; href?: string };

// Barres horizontales d'une seule série : valeurs écrites en clair, pas de légende.
export function BarList({ items, caption }: { items: BarItem[]; caption: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul aria-label={caption} className="space-y-3">
      {items.map((item) => {
        const row = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{item.label}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {formatBytes(item.value)}
                {item.detail && ` · ${item.detail}`}
              </span>
            </div>
            <div className="h-2" title={`${item.label} : ${formatBytes(item.value)}`}>
              <div
                className="h-full rounded-r-[4px] bg-accent"
                style={{ width: `${Math.max(0.5, (item.value / max) * 100)}%` }}
              />
            </div>
          </>
        );
        return (
          <li key={item.key}>
            {item.href ? (
              <Link href={item.href} className="block active:opacity-70">
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ul>
  );
}
