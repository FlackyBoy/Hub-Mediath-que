import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Utilisé par le healthcheck Docker. Public, ne renvoie aucune donnée.
export function GET() {
  try {
    getDb().prepare("SELECT 1").get();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
