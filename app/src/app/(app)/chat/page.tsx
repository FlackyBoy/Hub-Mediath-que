import type { Metadata } from "next";
import { displayMessages, isChatConfigured, listConversations, monthlyCost } from "@/lib/chat";
import { ChatClient } from "./chat-client";

export const metadata: Metadata = { title: "Chat" };

export default async function ChatPage({ searchParams }: PageProps<"/chat">) {
  const params = await searchParams;
  const conversations = listConversations();
  const requested = Number(params.c);
  const current = conversations.find((c) => c.id === requested) ?? null;
  const cost = monthlyCost();

  return (
    <>
      <ChatClient
        key={current?.id ?? "nouveau"}
        conversationId={current?.id ?? null}
        title={current?.title ?? null}
        initialMessages={current ? displayMessages(current.id) : []}
        conversations={conversations}
        configured={isChatConfigured()}
      />
      {cost > 0 && (
        <p className="mt-2 text-center text-[11px] text-muted">
          Coût estimé ce mois : {cost.toLocaleString("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 2 })}
        </p>
      )}
    </>
  );
}
