import Link from "next/link";
import { BookIcon, ChatIcon, FilmIcon } from "@/components/icons";
import { InstallHint } from "@/components/install-hint";
import { PageHeader } from "@/components/page-header";

const modules = [
  {
    href: "/mediatheque",
    title: "Médiathèque",
    description: "Fichiers, espace disque, recherche et téléchargements",
    Icon: FilmIcon,
  },
  {
    href: "/bibliotheque",
    title: "Bibliothèque",
    description: "Livres et BD, notes, scan ISBN",
    Icon: BookIcon,
  },
  {
    href: "/chat",
    title: "Chat",
    description: "Pose des questions sur tes données",
    Icon: ChatIcon,
  },
];

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("fr-FR", { hour: "numeric", timeZone: process.env.TZ || "Europe/Paris" }).format(
      new Date(),
    ),
  );
  return hour < 6 || hour >= 18 ? "Bonsoir" : "Bonjour";
}

export default function HomePage() {
  return (
    <>
      <PageHeader title={greeting()} subtitle="Que veux-tu faire ?" />
      <div className="space-y-4">
        <InstallHint />
        {modules.map(({ href, title, description, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 active:scale-[0.99]"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Icon className="size-6" />
            </span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-muted">{description}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
