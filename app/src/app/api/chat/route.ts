import { getSession } from "@/lib/auth";
import { isChatConfigured, runChat } from "@/lib/chat";

export const dynamic = "force-dynamic";

// Réponse en flux NDJSON : une ligne JSON par événement (texte, outil, fin, erreur).
export async function POST(request: Request) {
  if (!(await getSession())) return Response.json({ error: "Non authentifié" }, { status: 401 });
  if (!isChatConfigured()) return Response.json({ error: "ANTHROPIC_API_KEY manquant dans le .env" }, { status: 503 });

  let body: { conversationId?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Requête invalide" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 4000) return Response.json({ error: "Message vide ou trop long" }, { status: 400 });
  const conversationId = Number.isInteger(body.conversationId) ? (body.conversationId as number) : null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of runChat(conversationId, message, request.signal)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
