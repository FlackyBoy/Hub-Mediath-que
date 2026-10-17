import { getSession } from "@/lib/auth";
import { readCover } from "@/lib/covers";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: RouteContext<"/api/covers/[id]">) {
  if (!(await getSession())) return new Response("Non authentifié", { status: 401 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Introuvable", { status: 404 });
  const cover = await readCover(id);
  if (!cover) return new Response("Pas de couverture", { status: 404 });
  return new Response(new Uint8Array(cover.data), {
    headers: {
      "Content-Type": cover.type,
      // L'URL contient la date de mise à jour du livre : on peut garder en cache
      "Cache-Control": "private, max-age=2592000, immutable",
    },
  });
}
