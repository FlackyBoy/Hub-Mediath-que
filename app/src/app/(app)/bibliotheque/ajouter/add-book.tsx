"use client";

import { useCallback, useState } from "react";
import { SearchIcon } from "@/components/icons";
import type { BookCandidate } from "@/lib/book-meta";
import { lookupIsbnAction, searchBooksAction } from "../actions";
import { BookForm, EMPTY_BOOK, type BookFormValues } from "../book-form";
import { IsbnScanner } from "./isbn-scanner";

type Tab = "scan" | "search" | "manual";

function toValues(c: BookCandidate): BookFormValues {
  return {
    ...EMPTY_BOOK,
    title: c.title,
    author: c.author,
    publisher: c.publisher,
    year: c.year ? String(c.year) : "",
    pages: c.pages ? String(c.pages) : "",
    isbn: c.isbn,
  };
}

const input = "min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-base outline-none focus:border-accent";

export function AddBook({ styles }: { styles: string[] }) {
  const [tab, setTab] = useState<Tab>("scan");
  const [chosen, setChosen] = useState<{ values: BookFormValues; coverUrl: string | null } | null>(null);
  const [query, setQuery] = useState("");
  const [isbn, setIsbn] = useState("");
  const [results, setResults] = useState<BookCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const findIsbn = useCallback(async (code: string) => {
    setBusy(true);
    setMessage(null);
    const found = await lookupIsbnAction(code);
    setBusy(false);
    if (found) setChosen({ values: toValues(found), coverUrl: found.coverUrl });
    else {
      setMessage(`Aucun livre trouvé pour l'ISBN ${code}. Complète la fiche à la main.`);
      setChosen({ values: { ...EMPTY_BOOK, isbn: code }, coverUrl: null });
    }
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setResults(await searchBooksAction(query));
    setBusy(false);
  }

  if (chosen) {
    return (
      <div>
        <button className="mb-3 text-sm text-accent" onClick={() => setChosen(null)}>← Changer de livre</button>
        {message && <p className="mb-3 text-sm text-muted">{message}</p>}
        {chosen.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={chosen.coverUrl} alt="Couverture trouvée" className="mx-auto mb-4 w-32 rounded-md shadow" />
        )}
        <BookForm initial={chosen.values} coverUrl={chosen.coverUrl} styles={styles} />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface p-1" role="tablist">
        {([["scan", "Scanner"], ["search", "Rechercher"], ["manual", "Manuel"]] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-lg py-2 text-sm font-medium ${tab === key ? "bg-accent text-accent-foreground" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "scan" && (
        <div className="space-y-4">
          {busy ? <p className="p-6 text-center text-sm text-muted">Recherche du livre…</p> : <IsbnScanner onIsbn={findIsbn} />}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (isbn.trim()) findIsbn(isbn.trim());
            }}
            className="flex gap-2"
          >
            <input className={input} value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="Ou saisis l'ISBN" inputMode="numeric" />
            <button className="rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground" disabled={busy}>OK</button>
          </form>
        </div>
      )}

      {tab === "search" && (
        <div>
          <form onSubmit={search} className="mb-3 flex gap-2">
            <input className={input} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Titre et/ou auteur" autoFocus enterKeyHint="search" />
            <button aria-label="Rechercher" className="rounded-xl bg-accent px-3.5 text-accent-foreground" disabled={busy}>
              <SearchIcon className="size-5" />
            </button>
          </form>
          {busy && <p className="text-sm text-muted">Recherche…</p>}
          {results && !busy && (
            results.length === 0 ? (
              <p className="text-sm text-muted">
                Aucun résultat.{" "}
                <button className="text-accent" onClick={() => setChosen({ values: { ...EMPTY_BOOK, title: query }, coverUrl: null })}>
                  Saisir à la main
                </button>
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
                {results.map((c, i) => (
                  <li key={i}>
                    <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left" onClick={() => setChosen({ values: toValues(c), coverUrl: c.coverUrl })}>
                      {c.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.coverUrl} alt="" className="aspect-[2/3] w-10 rounded object-cover" loading="lazy" />
                      ) : (
                        <span className="aspect-[2/3] w-10 rounded bg-accent/15" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{c.title}</span>
                        <span className="block truncate text-sm text-muted">{[c.author, c.publisher, c.year].filter(Boolean).join(" · ")}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}

      {tab === "manual" && <BookForm initial={EMPTY_BOOK} styles={styles} />}
    </div>
  );
}
