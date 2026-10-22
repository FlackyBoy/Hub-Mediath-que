import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { BookCover } from "@/components/book-cover";
import { PageHeader } from "@/components/page-header";
import { isEnriching } from "@/lib/book-enrich";
import { countNewBookFiles } from "@/lib/book-files";
import { SORT_LABELS, STATUS_LABELS, TYPE_LABELS, type BookSort } from "@/lib/book-labels";
import { countBooks, distinctValues, listBooks, type Book } from "@/lib/books";
import { BooksToolbar, type ToolbarParams } from "./books-toolbar";

export const metadata: Metadata = { title: "Livres" };

function param(v: string | string[] | undefined): string {
  return typeof v === "string" ? v.trim().slice(0, 200) : "";
}

function Rating({ value }: { value: number | null }) {
  if (value === null) return null;
  return <span className="font-medium text-foreground">★ {value}/10</span>;
}

function meta(b: Book): React.ReactNode {
  return (
    <>
      {TYPE_LABELS[b.type]} · {STATUS_LABELS[b.status]}
      {b.rating !== null && (
        <>
          {" · "}
          <Rating value={b.rating} />
        </>
      )}
    </>
  );
}

export default async function BibliothequePage({ searchParams }: PageProps<"/bibliotheque">) {
  const sp = await searchParams;
  const savedView = (await cookies()).get("hub_books_view")?.value;
  const vueParam = param(sp.vue);
  const params: ToolbarParams = {
    q: param(sp.q),
    type: param(sp.type),
    statut: param(sp.statut),
    style: param(sp.style),
    note: param(sp.note),
    auteur: param(sp.auteur),
    editeur: param(sp.editeur),
    tri: (param(sp.tri) in SORT_LABELS ? param(sp.tri) : "titre") as BookSort,
    vue: vueParam === "grille" || vueParam === "liste" ? vueParam : savedView === "grille" ? "grille" : "liste",
  };

  const total = countBooks();
  const newFiles = countNewBookFiles();
  const books = listBooks({
    q: params.q,
    type: params.type,
    status: params.statut,
    style: params.style,
    author: params.auteur,
    publisher: params.editeur,
    minRating: params.note ? Number(params.note) : undefined,
    sort: params.tri,
  });

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Livres" subtitle={`${total} livre${total > 1 ? "s" : ""}`} />
        <div className="flex shrink-0 gap-2">
          <Link href="/bibliotheque/importer" className="rounded-xl border border-border px-3 py-2 text-sm font-medium">
            Synchro
          </Link>
          <Link href="/bibliotheque/ajouter" className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
            + Ajouter
          </Link>
        </div>
      </div>

      {newFiles > 0 && (
        <Link href="/bibliotheque/importer#fichiers" className="mb-3 block rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm font-medium text-accent">
          {newFiles} nouveau{newFiles > 1 ? "x" : ""} livre{newFiles > 1 ? "s" : ""} trouvé{newFiles > 1 ? "s" : ""} sur le serveur →
        </Link>
      )}

      {total === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm">
          <p className="mb-3 text-muted">Ta bibliothèque est vide.</p>
          <div className="flex justify-center gap-2">
            <Link href="/bibliotheque/importer" className="font-medium text-accent">Importer ton tableau</Link>
            <span className="text-muted">ou</span>
            <Link href="/bibliotheque/ajouter" className="font-medium text-accent">ajouter un livre</Link>
          </div>
        </div>
      ) : (
        <>
          <BooksToolbar
            params={params}
            styles={distinctValues("style")}
            authors={distinctValues("author")}
            publishers={distinctValues("publisher")}
          />
          {isEnriching() && <p className="mb-3 text-xs text-muted">Recherche des couvertures et des résumés en cours…</p>}
          <p className="mb-2 text-sm text-muted">
            {books.length} résultat{books.length > 1 ? "s" : ""}
          </p>

          {books.length === 0 ? (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">Aucun livre ne correspond.</p>
          ) : params.vue === "grille" ? (
            <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
              {books.map((b) => (
                <li key={b.id}>
                  <Link href={`/bibliotheque/${b.id}`} className="block active:opacity-70">
                    <BookCover id={b.id} version={b.updated_at} hasCover={b.cover === "ok" || b.cover === "doubtful"} title={b.title} author={b.author} />
                    <p className="mt-1 line-clamp-2 text-xs font-medium leading-tight">{b.title}</p>
                    {b.rating !== null && <p className="text-[11px] text-muted">★ {b.rating}/10</p>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {books.map((b) => (
                <li key={b.id}>
                  <Link href={`/bibliotheque/${b.id}`} className="flex items-center gap-3 px-4 py-2.5 active:bg-background">
                    <BookCover id={b.id} version={b.updated_at} hasCover={b.cover === "ok" || b.cover === "doubtful"} title={b.title} author={b.author} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{b.title}</span>
                      <span className="block truncate text-sm text-muted">{b.author || "Auteur inconnu"}</span>
                      <span className="block truncate text-xs text-muted">{meta(b)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
