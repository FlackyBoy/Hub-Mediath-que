import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getGame, updateGame } from "./games";

// Les fiches BGG sont en anglais : description, catégories et mécaniques traduites
// en français par Claude, une fois par fiche (le résultat est enregistré en base).

const Translation = z.object({
  description: z.string(),
  categories: z.array(z.string()),
  mechanics: z.array(z.string()),
});

let client: Anthropic | null = null;

export function isTranslationConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const split = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);

// Lancée sans attendre après le chargement de la fiche. Sans clé Anthropic ou en cas
// d'échec, la fiche reste en anglais
export async function translateGame(id: number): Promise<boolean> {
  if (!isTranslationConfigured()) return false;
  const g = getGame(id);
  if (!g || (!g.description && !g.categories && !g.mechanics)) return false;
  const categories = split(g.categories);
  const mechanics = split(g.mechanics);
  try {
    const response = await (client ??= new Anthropic()).messages.parse({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      max_tokens: 8000,
      output_config: { effort: "low", format: zodOutputFormat(Translation) },
      system:
        "Tu traduis des fiches de jeux de société de BoardGameGeek en français naturel, avec le vocabulaire des joueurs français " +
        "(Worker Placement = placement d'ouvriers, Deck Building = deck-building, Card Game = jeu de cartes, Cooperative Game = coopératif). " +
        "Garde les noms propres et le titre du jeu tels quels. Les listes gardent le même nombre d'éléments, dans le même ordre. " +
        "La description reste fidèle mais peut être allégée des mentions de contenu de boîte ou de crédits.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({ jeu: g.bgg_name || g.title, description: g.description, categories, mechanics }),
        },
      ],
    });
    const t = response.parsed_output;
    if (response.stop_reason !== "end_turn" || !t) return false;
    // Fiche modifiée entre-temps (autre fiche BGG choisie) : on n'écrase pas
    if (getGame(id)?.description !== g.description) return false;
    updateGame(id, {
      description: t.description.trim().slice(0, 8000),
      categories: (t.categories.length === categories.length ? t.categories : categories).join(", "),
      mechanics: (t.mechanics.length === mechanics.length ? t.mechanics : mechanics).join(", "),
    });
    return true;
  } catch (error) {
    console.error("Traduction de la fiche échouée pour le jeu", id, error);
    return false;
  }
}
