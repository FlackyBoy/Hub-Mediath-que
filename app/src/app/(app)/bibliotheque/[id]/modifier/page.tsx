import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { distinctValues, getBook } from "@/lib/books";
import { BookForm } from "../../book-form";

export const metadata: Metadata = { title: "Modifier le livre" };

export default async function ModifierPage({ params }: PageProps<"/bibliotheque/[id]/modifier">) {
  const book = getBook(Number((await params).id));
  if (!book) notFound();
  const str = (v: number | null) => (v === null ? "" : String(v));

  return (
    <>
      <nav className="mb-3 text-sm">
        <Link href={`/bibliotheque/${book.id}`} className="text-accent">← {book.title}</Link>
      </nav>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Modifier</h1>
      <BookForm
        bookId={book.id}
        styles={distinctValues("style")}
        initial={{
          title: book.title, author: book.author, rating: str(book.rating), status: book.status, type: book.type,
          style: book.style, publisher: book.publisher, year: str(book.year), pages: str(book.pages), isbn: book.isbn,
          summary: book.summary, pros: book.pros, cons: book.cons, notes: book.notes,
        }}
      />
    </>
  );
}
