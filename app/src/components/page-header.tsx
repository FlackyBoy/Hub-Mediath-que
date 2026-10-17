export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </header>
  );
}

export function ComingSoon({ items }: { items: string[] }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <p className="mb-3 text-sm font-semibold">Bientôt ici</p>
      <ul className="space-y-2 text-sm text-muted">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-accent">•</span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
