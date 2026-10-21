import type { Metadata } from "next";
import Link from "next/link";
import { isBggConfigured } from "@/lib/bgg";
import { AddGame } from "./add-game";

export const metadata: Metadata = { title: "Ajouter un jeu" };

export default function AjouterJeuPage() {
  return (
    <>
      <nav className="mb-3 text-sm"><Link href="/jeux" className="text-accent">Jeux</Link></nav>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Ajouter un jeu</h1>
      <AddGame bgg={isBggConfigured()} />
    </>
  );
}
