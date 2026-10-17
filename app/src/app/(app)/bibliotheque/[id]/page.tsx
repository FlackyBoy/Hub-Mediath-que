import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookCover } from "@/components/book-cover";
import { TYPE_LABELS } from "@/lib/book-labels";
import { getBook } from "@/lib/books";
import { BookActions, NotesEditor, RatingPicker, StatusPicker } from "./book-controls";

export const metadata: Metadata = { title: "Livre" };

function Block({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      <p className="whitespace-pre-line text-sm text-muted">{text}</p>
    </section>
  );
}

export default async function BookPage({ params }: PageProps<"/bibliotheque/[id]">) {
  const book = getBook(Number((await params).id));
  if (!book) notFound();

  const facts = [
    TYPE_LABELS[book.type],
    book.style,
    book.publisher,
    book.year ? String(book.year) : null,
    book.pages ? `${book.pages} pages` : null,
    book.isbn ? `ISBN ${book.isbn}` : null,
  ].filter(Boolean);

  return (
    <>
      <nav className="mb-3 text-sm">
        <Link href="/bibliotheque" className="text-accent">Livres</Link>
      </nav>

      <div className="mb-5 flex gap-4">
        <div className="shrink-0">
          <BookCover id={book.id} version={book.updated_at} hasCover={book.cover === "ok" || book.cover === "doubtful"} title={book.title} author={book.author} size="lg" />
          {book.cover === "doubtful" && <p className="mt-1 w-36 text-center text-[11px] text-muted">Couverture à vérifier</p>}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight">{book.title}</h1>
          <p className="mt-1 text-muted">{book.author || "Auteur inconnu"}</p>
          <p className="mt-2 text-xs text-muted">{facts.join(" · ")}</p>
        </div>
      </div>

      <div className="space-y-5">
        <StatusPicker id={book.id} value={book.status} />
        <RatingPicker id={book.id} value={book.rating} />
        <NotesEditor id={book.id} value={book.notes} />
        <Block title="Résumé" text={book.summary} />
        <Block title="Pourquoi j'aimerais" text={book.pros} />
        <Block title="Pourquoi je n'aimerais pas" text={book.cons} />
        <BookActions id={book.id} title={book.title} />
      </div>
    </>
  );
}
