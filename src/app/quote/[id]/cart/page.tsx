import { headers } from "next/headers";
import { redirect } from "next/navigation";

type CheckoutResult =
  | { checkoutUrl: string; message?: never }
  | { checkoutUrl?: never; message: string };

export default async function QuoteCartHandoff({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ dry_run_checkout?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  if (query?.dry_run_checkout === "1") {
    return (
      <CartMessage
        title="Dry-run checkout ready"
        message="This is a dry-run cart handoff. No BigCommerce cart was created, but the quote items were logged for verification."
        quoteId={id}
      />
    );
  }

  const result = await createCheckout(id);
  if (result.checkoutUrl) {
    redirect(result.checkoutUrl);
  }

  return (
    <CartMessage
      title="We couldn't load your cart"
      message={result.message ?? friendlyCartMessage()}
      quoteId={id}
    />
  );
}

async function createCheckout(quoteId: string): Promise<CheckoutResult> {
  try {
    const response = await fetch(`${await requestOrigin()}/api/quotes/${encodeURIComponent(quoteId)}/checkout`, {
      method: "POST",
      cache: "no-store",
    });
    const json = (await response.json().catch(() => ({}))) as {
      checkout_url?: string;
      error?: string;
    };

    if (!response.ok) {
      return { message: friendlyCartMessage(json.error) };
    }
    if (!json.checkout_url) {
      return { message: friendlyCartMessage() };
    }

    return { checkoutUrl: json.checkout_url };
  } catch {
    return { message: friendlyCartMessage() };
  }
}

async function requestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  if (!host) return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

function friendlyCartMessage(error?: string) {
  const base = "We couldn't load your cart — please contact Scubapix on 07 4031 7655.";
  if (error?.includes("unavailable") || error?.includes("out of stock")) {
    return `${base} One or more quoted products may no longer be available at current BigCommerce stock levels.`;
  }
  return base;
}

function CartMessage({
  title,
  message,
  quoteId,
}: {
  title: string;
  message: string;
  quoteId: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-6 py-12">
      <div className="max-w-xl rounded-[var(--radius)] border border-line bg-card p-8 text-center shadow-card">
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
        <p className="mt-5 text-xs text-muted">
          Quote <span className="font-mono text-ink-text">{quoteId}</span>
        </p>
      </div>
    </main>
  );
}
