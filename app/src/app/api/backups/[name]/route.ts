import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { getSession } from "@/lib/auth";
import { backupDir, isBackupName } from "@/lib/backup";

export const dynamic = "force-dynamic";

// Téléchargement d'une sauvegarde (nom strictement contrôlé : pas de chemin arbitraire)
export async function GET(_request: Request, ctx: RouteContext<"/api/backups/[name]">) {
  if (!(await getSession())) return new Response("Non authentifié", { status: 401 });
  const { name } = await ctx.params;
  if (!isBackupName(name)) return new Response("Introuvable", { status: 404 });
  const file = path.join(/* turbopackIgnore: true */ backupDir(), name);
  try {
    const st = await stat(file);
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
      headers: {
        "Content-Type": "application/gzip",
        "Content-Length": String(st.size),
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}
