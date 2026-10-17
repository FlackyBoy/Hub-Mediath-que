import type { Metadata } from "next";
import { ComingSoon, PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Chat" };

export default function ChatPage() {
  return (
    <>
      <PageHeader title="Chat" subtitle="Questions sur ta bibliothèque et ta médiathèque" />
      <ComingSoon
        items={[
          "« Que lire après Cormac McCarthy ? »",
          "« Quels livres de tel éditeur me manquent ? »",
          "« Combien d'espace prennent mes séries ? »",
        ]}
      />
    </>
  );
}
