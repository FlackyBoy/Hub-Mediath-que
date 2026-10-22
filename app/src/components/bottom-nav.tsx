"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookIcon, ChatIcon, DiceIcon, DownloadIcon, GaugeIcon, TvIcon } from "./icons";

// "match" : préfixes d'URL qui activent l'onglet (Réglages est accessible depuis le Tableau)
const items = [
  { href: "/", label: "Tableau", Icon: GaugeIcon, match: ["/fichiers", "/espace", "/reglages"] },
  { href: "/mediatheque", label: "Médias", Icon: DownloadIcon, match: [] },
  { href: "/ecrans", label: "Écrans", Icon: TvIcon, match: [] },
  { href: "/bibliotheque", label: "Livres", Icon: BookIcon, match: [] },
  { href: "/jeux", label: "Jeux", Icon: DiceIcon, match: [] },
  { href: "/chat", label: "Chat", Icon: ChatIcon, match: [] },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-2xl">
        {items.map(({ href, label, Icon, match }) => {
          const active =
            (href === "/" ? pathname === "/" : pathname.startsWith(href)) || match.some((m) => pathname.startsWith(m));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <Icon className="size-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
