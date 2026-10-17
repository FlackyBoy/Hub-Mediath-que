import type { Metadata } from "next";
import Link from "next/link";
import { distinctValues } from "@/lib/books";
import { AddBook } from "./add-book";

export const metadata: Metadata = { title: "Ajouter un livre" };

export default function AjouterPage() {
  return (
    <>
      <nav className="mb-3 text-sm">
        <Link href="/bibliotheque" className="text-accent">Livres</Link>
      </nav>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Ajouter un livre</h1>
      <AddBook styles={distinctValues("style")} />
    </>
  );
}
