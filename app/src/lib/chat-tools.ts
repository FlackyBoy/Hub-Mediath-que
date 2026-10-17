import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { STATUS_LABELS, TYPE_LABELS } from "./book-labels";
import { getBook, listBooks, type Book } from "./books";
import { getDb } from "./db";
import { diskUsage, getCategoryFolders, getScanInfo, getTypeBreakdown } from "./disk";
import { KIND_LABELS } from "./files";
import { listTorrents } from "./rtorrent";

// Outils du chat : lecture seule sur la bibliothèque, le disque et rTorrent.
// Claude interroge ce dont il a besoin au lieu de recevoir toute la base dans le prompt.

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);
const gb = (bytes: number) => Math.round((bytes / 1024 ** 3) * 10) / 10;

function brief(b: Book) {
  return {
    id: b.id,
    titre: b.title,
    auteur: b.author,
    note: b.rating,
    statut: STATUS_LABELS[b.status],
    type: TYPE_LABELS[b.type],
    style: b.style,
    editeur: b.publisher || undefined,
    annee: b.year ?? undefined,
  };
}

const StatusEnum = z.enum(["a_lire", "en_cours", "lu", "abandonne"]);
const TypeEnum = z.enum(["roman", "bd", "manga", "comics", "nouvelles", "theatre", "essai", "beau_livre"]);

const schemas = {
  search_books: z.object({
    query: z.string().max(200).optional(),
    author: z.string().max(200).optional(),
    publisher: z.string().max(200).optional(),
    style: z.string().max(100).optional(),
    type: TypeEnum.optional(),
    status: StatusEnum.optional(),
    min_rating: z.number().int().min(0).max(10).optional(),
    sort: z.enum(["titre", "auteur", "note", "ajout"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  get_book: z.object({ id: z.number().int().positive() }),
  get_rated_books: z.object({
    order: z.enum(["best", "worst"]).optional(),
    limit: z.number().int().min(1).max(60).optional(),
  }),
  library_stats: z.object({}),
  disk_usage: z.object({}),
  find_media: z.object({ query: z.string().min(1).max(200) }),
  folder_size: z.object({ path: z.string().min(1).max(500) }),
  list_downloads: z.object({
    state: z.enum(["active", "done", "all"]).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
};

export type ToolName = keyof typeof schemas;

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object" as const,
  properties,
  required,
  additionalProperties: false,
});

const statusDesc = "a_lire (pas encore lu), en_cours, lu, abandonne";
const typeDesc = "roman, bd, manga, comics, nouvelles, theatre, essai, beau_livre";

export const CHAT_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_books",
    description:
      "Recherche dans la bibliothèque de l'utilisateur (livres, BD, comics...). Tous les critères sont facultatifs et se combinent. " +
      "query cherche dans titre, auteur, style et éditeur (sans accents, mots en préfixe). Renvoie au plus `limit` livres (30 par défaut) avec le total.",
    input_schema: obj({
      query: { type: "string", description: "Mots à chercher" },
      author: { type: "string", description: "Auteur (correspondance partielle)" },
      publisher: { type: "string", description: "Éditeur (correspondance partielle)" },
      style: { type: "string", description: "Style ou genre (correspondance partielle), ex. polar, SF, western" },
      type: { type: "string", enum: Object.keys(TYPE_LABELS), description: typeDesc },
      status: { type: "string", enum: Object.keys(STATUS_LABELS), description: statusDesc },
      min_rating: { type: "integer", minimum: 0, maximum: 10, description: "Note minimale sur 10" },
      sort: { type: "string", enum: ["titre", "auteur", "note", "ajout"] },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    }),
    eager_input_streaming: true,
  },
  {
    name: "get_book",
    description: "Fiche complète d'un livre : résumé, « pourquoi j'aimerais », « pourquoi je n'aimerais pas », avis personnel de l'utilisateur, éditeur, pages.",
    input_schema: obj({ id: { type: "integer", description: "Identifiant renvoyé par search_books" } }, ["id"]),
    eager_input_streaming: true,
  },
  {
    name: "get_rated_books",
    description:
      "Livres notés par l'utilisateur avec note, style, avis et points positifs : la base pour comprendre ses goûts et faire des recommandations. " +
      "order=best pour les mieux notés (par défaut), worst pour les moins aimés.",
    input_schema: obj({ order: { type: "string", enum: ["best", "worst"] }, limit: { type: "integer", minimum: 1, maximum: 60 } }),
    eager_input_streaming: true,
  },
  {
    name: "library_stats",
    description: "Statistiques de la bibliothèque : nombre de livres par statut et par type, note moyenne, auteurs et styles les plus présents, derniers ajouts.",
    input_schema: obj({}),
    eager_input_streaming: true,
  },
  {
    name: "disk_usage",
    description:
      "Espace disque du serveur : libre / utilisé / total, et répartition de la dernière analyse par dossier (download/films, download/series...) et par type de fichier. Tailles en Go.",
    input_schema: obj({}),
    eager_input_streaming: true,
  },
  {
    name: "find_media",
    description: "Cherche des dossiers de médias par nom sur le serveur (films, séries, BD téléchargés...) et donne leur taille. Utile pour « est-ce que j'ai déjà X ? ».",
    input_schema: obj({ query: { type: "string", description: "Nom ou partie du nom" } }, ["query"]),
    eager_input_streaming: true,
  },
  {
    name: "folder_size",
    description: "Taille d'un dossier précis (chemin comme download/series) et de ses sous-dossiers, triés du plus gros au plus petit.",
    input_schema: obj({ path: { type: "string", description: "Chemin relatif, ex. download/series" } }, ["path"]),
    eager_input_streaming: true,
  },
  {
    name: "list_downloads",
    description: "Torrents de rTorrent : en cours (progression, débit, temps restant) ou terminés (date, ratio).",
    input_schema: obj({ state: { type: "string", enum: ["active", "done", "all"] }, limit: { type: "integer", minimum: 1, maximum: 100 } }),
    eager_input_streaming: true,
  },
];

export const TOOL_LABELS: Record<ToolName, string> = {
  search_books: "Recherche dans la bibliothèque",
  get_book: "Lecture d'une fiche livre",
  get_rated_books: "Analyse de tes notes",
  library_stats: "Statistiques de la bibliothèque",
  disk_usage: "Lecture de l'espace disque",
  find_media: "Recherche dans les fichiers",
  folder_size: "Taille d'un dossier",
  list_downloads: "Lecture des téléchargements",
};

async function run(name: ToolName, input: unknown): Promise<unknown> {
  switch (name) {
    case "search_books": {
      const p = schemas.search_books.parse(input);
      let books = listBooks({
        q: [p.query, p.author].filter(Boolean).join(" ") || undefined,
        type: p.type,
        status: p.status,
        minRating: p.min_rating,
        sort: p.sort,
      });
      if (p.publisher) books = books.filter((b) => norm(b.publisher).includes(norm(p.publisher!)));
      if (p.style) books = books.filter((b) => norm(b.style).includes(norm(p.style!)));
      const limit = p.limit ?? 30;
      return { total: books.length, affiches: Math.min(limit, books.length), livres: books.slice(0, limit).map(brief) };
    }
    case "get_book": {
      const { id } = schemas.get_book.parse(input);
      const b = getBook(id);
      if (!b) throw new Error(`Aucun livre avec l'id ${id}`);
      return {
        ...brief(b),
        pages: b.pages ?? undefined,
        isbn: b.isbn || undefined,
        resume: b.summary,
        pourquoi_j_aimerais: b.pros,
        pourquoi_je_n_aimerais_pas: b.cons,
        mon_avis: b.notes,
        ajoute_le: b.created_at.slice(0, 10),
      };
    }
    case "get_rated_books": {
      const p = schemas.get_rated_books.parse(input);
      const rated = listBooks({ sort: "note" }).filter((b) => b.rating !== null);
      const ordered = p.order === "worst" ? [...rated].reverse() : rated;
      return {
        total_notes: rated.length,
        livres: ordered.slice(0, p.limit ?? 30).map((b) => ({
          ...brief(b),
          mon_avis: clip(b.notes, 400) || undefined,
          pourquoi_j_aimerais: clip(b.pros, 250) || undefined,
          pourquoi_je_n_aimerais_pas: clip(b.cons, 250) || undefined,
        })),
      };
    }
    case "library_stats": {
      const db = getDb();
      const q = <T,>(sql: string) => db.prepare(sql).all() as T[];
      return {
        total: (db.prepare("SELECT COUNT(*) AS n FROM books").get() as { n: number }).n,
        par_statut: Object.fromEntries(
          q<{ status: keyof typeof STATUS_LABELS; n: number }>("SELECT status, COUNT(*) AS n FROM books GROUP BY status").map((r) => [STATUS_LABELS[r.status], r.n]),
        ),
        par_type: Object.fromEntries(
          q<{ type: keyof typeof TYPE_LABELS; n: number }>("SELECT type, COUNT(*) AS n FROM books GROUP BY type ORDER BY n DESC").map((r) => [TYPE_LABELS[r.type], r.n]),
        ),
        note_moyenne: (db.prepare("SELECT ROUND(AVG(rating), 1) AS m FROM books WHERE rating IS NOT NULL").get() as { m: number | null }).m,
        auteurs_principaux: q("SELECT author AS auteur, COUNT(*) AS livres FROM books WHERE author != '' GROUP BY author ORDER BY livres DESC LIMIT 12"),
        styles_principaux: q("SELECT style, COUNT(*) AS livres FROM books WHERE style != '' GROUP BY style ORDER BY livres DESC LIMIT 12"),
        derniers_ajouts: q<{ title: string; author: string }>("SELECT title, author FROM books ORDER BY created_at DESC, id DESC LIMIT 5"),
      };
    }
    case "disk_usage": {
      const usage = await diskUsage();
      const scan = getScanInfo();
      return {
        disque_go: usage ? { libre: gb(usage.free), utilise: gb(usage.used), total: gb(usage.total) } : "indisponible",
        derniere_analyse: scan.finishedAt ?? "jamais (lancer une analyse dans Tableau > Espace disque)",
        par_dossier_go: getCategoryFolders().map((f) => ({ dossier: f.rel, go: gb(f.size), fichiers: f.files })),
        par_type_go: getTypeBreakdown().map((t) => ({ type: KIND_LABELS[t.kind], go: gb(t.size), fichiers: t.files })),
      };
    }
    case "find_media": {
      const { query } = schemas.find_media.parse(input);
      const words = norm(query).split(/\s+/).filter(Boolean);
      const rows = getDb().prepare("SELECT rel, size, files FROM dir_sizes").all() as { rel: string; size: number; files: number }[];
      const hits = rows.filter((r) => words.every((w) => norm(r.rel).includes(w))).sort((a, b) => b.size - a.size);
      return {
        trouves: hits.length,
        dossiers: hits.slice(0, 25).map((r) => ({ chemin: r.rel, go: gb(r.size), fichiers: r.files })),
        remarque: rows.length === 0 ? "Aucune analyse du disque : les dossiers ne sont pas encore indexés." : undefined,
      };
    }
    case "folder_size": {
      const { path } = schemas.folder_size.parse(input);
      const rel = path.replace(/^\/+|\/+$/g, "").replace(/^home\/viou\//, "");
      const db = getDb();
      const row = db.prepare("SELECT size, files FROM dir_sizes WHERE rel = ?").get(rel) as { size: number; files: number } | undefined;
      if (!row) throw new Error(`Dossier inconnu : ${rel}. Utilise find_media pour le trouver.`);
      const depth = rel.split("/").length + 1;
      const children = (db.prepare("SELECT rel, size, files FROM dir_sizes WHERE rel LIKE ? ESCAPE '\\'").all(
        rel.replace(/[\\%_]/g, (m) => `\\${m}`) + "/%",
      ) as { rel: string; size: number; files: number }[]).filter((c) => c.rel.split("/").length === depth);
      return {
        dossier: rel,
        go: gb(row.size),
        fichiers: row.files,
        sous_dossiers: children.sort((a, b) => b.size - a.size).slice(0, 25).map((c) => ({ nom: c.rel.split("/").pop(), go: gb(c.size) })),
      };
    }
    case "list_downloads": {
      const p = schemas.list_downloads.parse(input);
      const all = await listTorrents();
      const state = p.state ?? "active";
      const picked = all
        .filter((t) => (state === "all" ? true : state === "active" ? !t.complete : t.complete))
        .sort((a, b) => (b.complete ? b.finishedAt : b.addedAt) - (a.complete ? a.finishedAt : a.addedAt));
      return {
        total: picked.length,
        torrents: picked.slice(0, p.limit ?? 20).map((t) => ({
          nom: t.name,
          progression: `${Math.floor((t.done / Math.max(1, t.size)) * 100)} %`,
          etat: t.state,
          go: gb(t.size),
          debit_ko_s: t.complete ? undefined : Math.round(t.downRate / 1024),
          termine_le: t.complete && t.finishedAt ? new Date(t.finishedAt).toISOString().slice(0, 10) : undefined,
          ratio: Math.round(t.ratio * 100) / 100,
        })),
      };
    }
  }
}

// Exécute un outil : valide l'entrée (le streaming des entrées ne la valide pas côté API)
export async function executeTool(name: string, input: unknown): Promise<{ content: string; isError: boolean }> {
  if (!(name in schemas)) return { content: `Outil inconnu : ${name}`, isError: true };
  const parsed = schemas[name as ToolName].safeParse(input);
  if (!parsed.success) {
    return { content: JSON.stringify({ INVALID_JSON: JSON.stringify(input), erreurs: parsed.error.issues.map((i) => i.message) }), isError: true };
  }
  try {
    const result = await run(name as ToolName, parsed.data);
    return { content: clip(JSON.stringify(result), 30000), isError: false };
  } catch (error) {
    return { content: (error as Error).message, isError: true };
  }
}
