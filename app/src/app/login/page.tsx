import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 pt-[env(safe-area-inset-top)]">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image src="/icons/icon-192.png" alt="" width={64} height={64} className="rounded-2xl" priority />
          <h1 className="text-2xl font-bold">Hub</h1>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6">
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </div>
      </div>
    </main>
  );
}
