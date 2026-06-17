export default async function QuoteCartPlaceholder({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="grid min-h-screen place-items-center bg-surface px-6 py-12">
      <div className="max-w-xl rounded-[var(--radius)] border border-line bg-card p-8 text-center shadow-card">
        <h1 className="font-display text-2xl font-semibold text-ink">Cart step coming soon</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Quote <span className="font-mono text-ink-text">{id}</span> is ready for the future cart
          handoff. For now, please contact Scubapix to proceed.
        </p>
        {/* TODO: At the checkout checkpoint, replace this placeholder with POST /api/quotes/:id/checkout -> BigCommerce cart + checkout URL, honouring quoted prices rather than live prices. */}
      </div>
    </main>
  );
}
