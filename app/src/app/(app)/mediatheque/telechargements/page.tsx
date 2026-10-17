import { redirect } from "next/navigation";

// Ancienne adresse (notifications déjà envoyées) : le suivi est maintenant sur /mediatheque.
export default function TelechargementsRedirect() {
  redirect("/mediatheque");
}
