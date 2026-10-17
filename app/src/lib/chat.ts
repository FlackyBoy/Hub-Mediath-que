import Anthropic from "@anthropic-ai/sdk";
import { CHAT_TOOLS, executeTool, TOOL_LABELS, type ToolName } from "./chat-tools";
import { getDb } from "./db";

// Chat avec Claude : boucle d'outils en streaming, conversations stockées en base.
// Le contenu des réponses est conservé tel que renvoyé par l'API (blocs de réflexion
// et de repli compris) : il doit être renvoyé à l'identique aux tours suivants.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
const EFFORT = (process.env.ANTHROPIC_EFFORT || "medium") as "low" | "medium" | "high";
const MAX_TOOL_ROUNDS = 8;

// Tarifs de claude-opus-5-5 en $ par million de jetons (estimation affichée dans le chat)
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

const SYSTEM = `Tu es l'assistant personnel du « Hub » de Virgile, une application qui regroupe une bibliothèque (livres, BD, comics, mangas), une liste de films et séries, et une médiathèque (serveur de fichiers, téléchargements). Tu tutoies Virgile.

Réponds en français, de façon concise et chaleureuse : la lecture se fait sur téléphone. Utilise des listes courtes et du gras pour les titres.

Données :
- Utilise les outils pour toute question sur la bibliothèque, les goûts de lecture, le disque ou les téléchargements. N'affirme jamais qu'un livre est dans la bibliothèque sans l'avoir vérifié avec search_books.
- Statuts : « À lire » = possédé ou noté mais pas encore lu ; « Lu » ; « En cours » ; « Abandonné ».
- Quand tu cites un livre de la bibliothèque, fais un lien Markdown vers sa fiche : [Titre](/bibliotheque/ID).

Recommandations :
- Appuie-toi sur get_rated_books (notes, avis, « pourquoi j'aimerais ») pour cerner ce que Virgile aime, et sur les livres « Abandonné » ou mal notés pour ce qui ne plaît pas.
- Propose d'abord des livres de la pile « À lire » qui correspondent, puis éventuellement des titres absents de la bibliothèque (en le disant clairement).
- Explique en une phrase pourquoi chaque titre devrait plaire, en le reliant à un livre bien noté.
- Ne recommande pas un livre déjà lu, sauf demande explicite.

Films et séries (onglet « Écrans ») :
- search_screens et get_rated_screens donnent la liste, les notes et les avis ; « Pas pour moi » = rejeté, à ne jamais recommander.
- Pour recommander, croise les goûts à l'écran ET en lecture (un amateur de McCarthy appréciera peut-être No Country for Old Men au cinéma).
- Vérifie chaque titre proposé avec tmdb_lookup et indique où le regarder en France ; signale s'il est déjà « Sur ton Plex ».
- Lien vers une fiche de la liste : [Titre](/ecrans/ID).

Médiathèque : les tailles sont en Go. Si l'analyse du disque est ancienne ou absente, signale-le.`;

export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; label: string }
  | { type: "done"; conversationId: number; title: string }
  | { type: "error"; message: string };

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  return (client ??= new Anthropic());
}

export function isChatConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

type StoredMessage = { role: "user" | "assistant"; content: string };

function loadHistory(conversationId: number): Anthropic.Beta.BetaMessageParam[] {
  const rows = getDb()
    .prepare("SELECT role, content FROM chat_messages WHERE conversation_id = ? ORDER BY id")
    .all(conversationId) as StoredMessage[];
  return rows.map((r) => ({ role: r.role, content: JSON.parse(r.content) }));
}

function saveMessage(conversationId: number, message: Anthropic.Beta.BetaMessageParam, usage?: Anthropic.Beta.BetaUsage) {
  const db = getDb();
  db.prepare(
    `INSERT INTO chat_messages (conversation_id, role, content, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    conversationId,
    message.role,
    JSON.stringify(message.content),
    usage?.input_tokens ?? 0,
    usage?.output_tokens ?? 0,
    usage?.cache_read_input_tokens ?? 0,
    usage?.cache_creation_input_tokens ?? 0,
  );
  db.prepare("UPDATE chat_conversations SET updated_at = datetime('now') WHERE id = ?").run(conversationId);
}

function errorMessage(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "Clé API Anthropic refusée : vérifie ANTHROPIC_API_KEY.";
  if (error instanceof Anthropic.PermissionDeniedError) return "Accès refusé par l'API Anthropic.";
  if (error instanceof Anthropic.RateLimitError) return "Trop de requêtes pour le moment, réessaie dans une minute.";
  if (error instanceof Anthropic.BadRequestError) return `Requête refusée par l'API : ${error.message}`;
  if (error instanceof Anthropic.APIError) return `Erreur de l'API Anthropic (${error.status ?? "réseau"}). Réessaie.`;
  if ((error as Error).name === "AbortError") return "Réponse interrompue.";
  console.error("Chat", error);
  return "Erreur inattendue.";
}

export async function* runChat(
  conversationId: number | null,
  userText: string,
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const db = getDb();
  let id = conversationId;
  let title: string;
  if (id && db.prepare("SELECT 1 FROM chat_conversations WHERE id = ?").get(id)) {
    title = (db.prepare("SELECT title FROM chat_conversations WHERE id = ?").get(id) as { title: string }).title;
  } else {
    title = userText.replace(/\s+/g, " ").trim().slice(0, 60);
    id = Number(db.prepare("INSERT INTO chat_conversations (title) VALUES (?)").run(title).lastInsertRowid);
  }

  const messages = loadHistory(id);
  const userMessage: Anthropic.Beta.BetaMessageParam = { role: "user", content: userText };
  messages.push(userMessage);
  saveMessage(id, userMessage);

  try {
    let jsonRetries = 0;
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const stream = anthropic().beta.messages.stream(
        {
          model: MODEL,
          max_tokens: 16000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default", // si la requête est refusée par les garde-fous, un autre modèle reprend
          output_config: { effort: EFFORT },
          cache_control: { type: "ephemeral" },
          system: SYSTEM,
          tools: CHAT_TOOLS,
          messages,
        },
        { signal },
      );

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield { type: "text", delta: event.delta.text };
        } else if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
          const label = TOOL_LABELS[event.content_block.name as ToolName] ?? event.content_block.name;
          yield { type: "tool", label };
        }
      }

      let message: Anthropic.Beta.BetaMessage;
      try {
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (error) {
        // Entrée d'outil illisible (streaming des entrées) : on rejoue le tour, 2 fois au plus
        if (error instanceof Anthropic.APIError || jsonRetries++ >= 2) throw error;
        continue;
      }

      if (message.stop_reason === "refusal") {
        saveMessage(id, { role: "assistant", content: message.content }, message.usage);
        yield { type: "text", delta: "\n\nJe ne peux pas répondre à cette demande." };
        break;
      }
      if (message.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: message.content });
        saveMessage(id, { role: "assistant", content: message.content }, message.usage);
        continue;
      }

      const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (toolUses.length === 0) {
        saveMessage(id, { role: "assistant", content: message.content }, message.usage);
        break;
      }
      if (message.stop_reason === "max_tokens") throw new Error("Réponse tronquée");
      if (round === MAX_TOOL_ROUNDS) {
        yield { type: "text", delta: "\n\n(Trop d'étapes pour cette question : reformule-la plus précisément.)" };
        break;
      }

      // Tous les résultats d'outils dans un seul message, sauvegardés avec l'appel correspondant
      const results = await Promise.all(toolUses.map((t) => executeTool(t.name, t.input)));
      const assistantTurn: Anthropic.Beta.BetaMessageParam = { role: "assistant", content: message.content };
      const toolTurn: Anthropic.Beta.BetaMessageParam = {
        role: "user",
        content: toolUses.map((t, i) => ({
          type: "tool_result" as const,
          tool_use_id: t.id,
          content: results[i].content,
          is_error: results[i].isError || undefined,
        })),
      };
      messages.push(assistantTurn, toolTurn);
      saveMessage(id, assistantTurn, message.usage);
      saveMessage(id, toolTurn);
    }
    yield { type: "done", conversationId: id, title };
  } catch (error) {
    yield { type: "error", message: errorMessage(error) };
    yield { type: "done", conversationId: id, title };
  }
}

// --- Lecture des conversations pour l'affichage ---

export type Conversation = { id: number; title: string; updated_at: string };

export function listConversations(limit = 40): Conversation[] {
  const rows = getDb()
    .prepare("SELECT id, title, updated_at FROM chat_conversations ORDER BY updated_at DESC, id DESC LIMIT ?")
    .all(limit) as Conversation[];
  // node:sqlite renvoie des objets sans prototype : React refuse de les passer aux composants client
  return rows.map((r) => ({ id: r.id, title: r.title, updated_at: r.updated_at }));
}

export function deleteConversation(id: number) {
  getDb().prepare("DELETE FROM chat_messages WHERE conversation_id = ?").run(id);
  getDb().prepare("DELETE FROM chat_conversations WHERE id = ?").run(id);
}

export type DisplayMessage = { role: "user" | "assistant"; text: string; tools: string[] };

// Fusionne les tours (réponse, outils, réponse...) en bulles lisibles
export function displayMessages(conversationId: number): DisplayMessage[] {
  const out: DisplayMessage[] = [];
  for (const m of loadHistory(conversationId)) {
    if (m.role === "user") {
      if (typeof m.content === "string") out.push({ role: "user", text: m.content, tools: [] });
      continue; // résultats d'outils : non affichés
    }
    const blocks = Array.isArray(m.content) ? m.content : [];
    const text = blocks.map((b) => (b.type === "text" ? b.text : "")).join("");
    const tools = blocks.flatMap((b) => (b.type === "tool_use" ? [TOOL_LABELS[b.name as ToolName] ?? b.name] : []));
    const last = out.at(-1);
    if (last?.role === "assistant") {
      last.text += (last.text && text ? "\n\n" : "") + text;
      last.tools.push(...tools);
    } else out.push({ role: "assistant", text, tools });
  }
  return out;
}

// Coût estimé du mois en cours (en $), d'après les jetons enregistrés
export function monthlyCost(): number {
  const r = getDb()
    .prepare(
      `SELECT COALESCE(SUM(input_tokens), 0) AS i, COALESCE(SUM(output_tokens), 0) AS o,
              COALESCE(SUM(cache_read_tokens), 0) AS cr, COALESCE(SUM(cache_write_tokens), 0) AS cw
       FROM chat_messages WHERE created_at >= date('now', 'start of month')`,
    )
    .get() as { i: number; o: number; cr: number; cw: number };
  return (r.i * PRICE.input + r.o * PRICE.output + r.cr * PRICE.cacheRead + r.cw * PRICE.cacheWrite) / 1e6;
}
