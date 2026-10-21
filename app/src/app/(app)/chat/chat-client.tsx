"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { TrashIcon } from "@/components/icons";
import { btn, Modal } from "@/components/modal";
import type { Conversation, DisplayMessage } from "@/lib/chat";
import { deleteConversationAction } from "./actions";
import { Markdown } from "./markdown";

const SUGGESTIONS = [
  "Que lire après Cormac McCarthy ?",
  "Qu'est-ce que je pourrais lire dans ma pile « À lire » ce mois-ci ?",
  "À quel jeu jouer ce soir à 2, en moins d'une heure ?",
  "Quel jeu de société acheter d'après ceux que j'aime ?",
  "Combien d'espace prennent mes séries ?",
  "Quels comics Batman ai-je déjà ?",
];

type Bubble = DisplayMessage & { pending?: boolean; status?: string; error?: string };

export function ChatClient({
  conversationId: initialId,
  title: initialTitle,
  initialMessages,
  conversations,
  configured,
}: {
  conversationId: number | null;
  title: string | null;
  initialMessages: DisplayMessage[];
  conversations: Conversation[];
  configured: boolean;
}) {
  const [conversationId, setConversationId] = useState(initialId);
  const [title, setTitle] = useState(initialTitle);
  const [messages, setMessages] = useState<Bubble[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function updateLast(fn: (b: Bubble) => Bubble) {
    setMessages((prev) => [...prev.slice(0, -1), fn(prev[prev.length - 1])]);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: message, tools: [] },
      { role: "assistant", text: "", tools: [], pending: true, status: "Réflexion…" },
    ]);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `Erreur ${res.status}` }));
        throw new Error(err.error ?? `Erreur ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "text") updateLast((b) => ({ ...b, text: b.text + ev.delta, status: undefined }));
          else if (ev.type === "tool") updateLast((b) => ({ ...b, tools: [...b.tools, ev.label], status: `${ev.label}…` }));
          else if (ev.type === "error") updateLast((b) => ({ ...b, error: ev.message }));
          else if (ev.type === "done") {
            setConversationId(ev.conversationId);
            setTitle(ev.title);
            // Adresse de la conversation, sans recharger la page
            window.history.replaceState(null, "", `/chat?c=${ev.conversationId}`);
          }
        }
      }
    } catch (error) {
      const aborted = (error as Error).name === "AbortError";
      updateLast((b) => ({ ...b, error: aborted ? "Réponse interrompue." : (error as Error).message }));
    } finally {
      updateLast((b) => ({ ...b, pending: false, status: undefined }));
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col">
      <header className="mb-3 flex items-center justify-between gap-2">
        <button onClick={() => setListOpen(true)} className="min-w-0 text-left">
          <h1 className="truncate text-2xl font-bold tracking-tight">{title ?? "Chat"}</h1>
          <p className="text-xs text-muted">Conversations ▾</p>
        </button>
        <div className="flex shrink-0 gap-2">
          {conversationId && (
            <button aria-label="Supprimer la conversation" onClick={() => setConfirmDelete(true)} className="rounded-xl border border-border p-2 text-muted">
              <TrashIcon className="size-5" />
            </button>
          )}
          <Link href="/chat" onClick={() => { setMessages([]); setConversationId(null); setTitle(null); }} className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
            + Nouveau
          </Link>
        </div>
      </header>

      {!configured && (
        <p className="mb-3 rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
          Le chat n&apos;est pas encore configuré : il manque la clé API Anthropic (ANTHROPIC_API_KEY) sur le serveur.
        </p>
      )}

      <div className="flex-1 space-y-3">
        {messages.length === 0 && configured && (
          <div className="space-y-2 pt-4">
            <p className="text-sm text-muted">Pose une question sur ta bibliothèque, tes goûts de lecture ou ton serveur :</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)} className="block w-full rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="ml-10 rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-[15px] text-accent-foreground">
              <p className="whitespace-pre-wrap">{m.text}</p>
            </div>
          ) : (
            <div key={i} className="mr-4 rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3 text-[15px] leading-relaxed">
              {m.tools.length > 0 && (
                <p className="mb-2 text-xs text-muted">🔎 {[...new Set(m.tools)].join(" · ")}</p>
              )}
              {m.text && <Markdown text={m.text} />}
              {m.pending && m.status && <p className="animate-pulse text-sm text-muted">{m.status}</p>}
              {m.error && <p className="mt-2 text-sm text-danger">{m.error}</p>}
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] mt-4 flex items-end gap-2 bg-background pt-2"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder={configured ? "Écris ta question…" : "Chat indisponible"}
          disabled={!configured}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-base outline-none focus:border-accent"
        />
        {busy ? (
          <button type="button" onClick={() => abortRef.current?.abort()} className="h-11 rounded-2xl border border-border px-4 text-sm font-semibold">
            Stop
          </button>
        ) : (
          <button type="submit" disabled={!input.trim() || !configured} className="h-11 rounded-2xl bg-accent px-4 text-sm font-semibold text-accent-foreground disabled:opacity-50">
            Envoyer
          </button>
        )}
      </form>

      {listOpen && (
        <Modal title="Conversations" onClose={() => setListOpen(false)}>
          {conversations.length === 0 ? (
            <p className="text-sm text-muted">Aucune conversation enregistrée.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
              {conversations.map((c) => (
                <li key={c.id}>
                  <a href={`/chat?c=${c.id}`} className={`block truncate py-3 text-sm ${c.id === conversationId ? "font-semibold text-accent" : ""}`}>
                    {c.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {confirmDelete && conversationId && (
        <Modal title="Supprimer cette conversation ?" onClose={() => setConfirmDelete(false)}>
          <div className="grid grid-cols-2 gap-2">
            <button className={btn.ghost} onClick={() => setConfirmDelete(false)}>Annuler</button>
            <button className={btn.danger} onClick={() => deleteConversationAction(conversationId)}>Supprimer</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
