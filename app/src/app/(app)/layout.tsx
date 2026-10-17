import { BottomNav } from "@/components/bottom-nav";
import { requireSession } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireSession();

  return (
    <>
      <main className="mx-auto max-w-2xl px-4 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-[calc(env(safe-area-inset-bottom)+5.5rem)]">
        {children}
      </main>
      <BottomNav />
    </>
  );
}
