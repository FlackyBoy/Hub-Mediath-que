import Link from "next/link";
import { filesHref } from "@/lib/media-links";
import { ChevronRightIcon } from "./icons";

// Fil d'Ariane : Fichiers > download > series > ...
export function Breadcrumb({ rel, linkLast = false }: { rel: string; linkLast?: boolean }) {
  const segments = rel.split("/").filter(Boolean);
  return (
    <nav aria-label="Chemin" className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted">
      <Link href={filesHref("")} className="text-accent">
        Fichiers
      </Link>
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={i} className="flex min-w-0 items-center gap-1">
            <ChevronRightIcon className="size-3.5 shrink-0" />
            {isLast && !linkLast ? (
              <span className="truncate text-foreground">{seg}</span>
            ) : (
              <Link href={filesHref(segments.slice(0, i + 1).join("/"))} className="truncate text-accent">
                {seg}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
