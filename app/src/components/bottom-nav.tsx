"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookIcon, ChatIcon, FilmIcon, HomeIcon, SettingsIcon } from "./icons";

const items = [
  { href: "/", label: "Accueil", Icon: HomeIcon },
  { href: "/mediatheque", label: "Médias", Icon: FilmIcon },
  { href: "/bibliotheque", label: "Livres", Icon: BookIcon },
  { href: "/chat", label: "Chat", Icon: ChatIcon },
  { href: "/reglages", label: "Réglages", Icon: SettingsIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-2xl">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
