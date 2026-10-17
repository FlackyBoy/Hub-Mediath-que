"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";

// Rendu Markdown des réponses (pas de HTML brut). Liens internes (/bibliotheque/12) en navigation
// de l'app, liens externes dans un nouvel onglet ; tout autre schéma d'URL est neutralisé.
export function Markdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      urlTransform={(url) => (url.startsWith("/") || /^https?:\/\//.test(url) ? url : "")}
      components={{
        a: ({ href, children }) =>
          href?.startsWith("/") ? (
            <Link href={href} className="font-medium text-accent underline underline-offset-2">
              {children}
            </Link>
          ) : href ? (
            <a href={href} target="_blank" rel="noreferrer" className="text-accent underline underline-offset-2">
              {children}
            </a>
          ) : (
            <span>{children}</span>
          ),
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5">{children}</ol>,
        h1: ({ children }) => <p className="mb-2 font-bold">{children}</p>,
        h2: ({ children }) => <p className="mb-2 font-bold">{children}</p>,
        h3: ({ children }) => <p className="mb-1 font-semibold">{children}</p>,
        code: ({ children }) => <code className="rounded bg-background px-1 text-[0.9em]">{children}</code>,
        table: ({ children }) => <div className="mb-2 overflow-x-auto"><table className="text-sm">{children}</table></div>,
        th: ({ children }) => <th className="border-b border-border px-2 py-1 text-left">{children}</th>,
        td: ({ children }) => <td className="border-b border-border px-2 py-1">{children}</td>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
