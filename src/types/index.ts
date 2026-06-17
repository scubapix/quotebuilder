/** Data shapes derived from index_5.html prototype */

export type AppMode = "demo" | "dry_run" | "live";

export type QuoteStatus = "draft" | "sent" | "accepted" | "ordered";

export interface Customer {
  id: string | number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street1: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  countryIso2: string;
}

export interface CatalogItem {
  productId: number;
  variantId: number | null;
  sku: string;
  name: string;
  priceCents: number;
  cat: string;
  category: string;
}

export interface LineItem {
  lid: string;
  productId: number;
  variantId: number | null;
  sku: string;
  name: string;
  priceCents: number;
  qty: number;
}

export interface TradeIn {
  id: string;
  label: string;
  amountCents: number;
}

export interface CheckoutInfo {
  url: string;
}

export interface Quote {
  id: string;
  name: string;
  status: QuoteStatus;
  items: LineItem[];
  tradeins: TradeIn[];
  checkout: CheckoutInfo | null;
  quoteNo?: string;
  saved?: boolean;
  persisted?: boolean;
  pdfUrl?: string;
  pdfFilename?: string;
}

export interface QuoteTotals {
  sub: number;
  gst: number;
  total: number;
  trade: number;
  payable: number;
}

export function totals(quote: Pick<Quote, "items" | "tradeins">): QuoteTotals {
  let sub = 0;
  quote.items.forEach((i) => {
    sub += i.qty * i.priceCents;
  });
  const gst = Math.round(sub * 0.1);
  const total = sub + gst;
  const trade = (quote.tradeins || []).reduce((s, t) => s + (Number(t.amountCents) || 0), 0);
  return { sub, gst, total, trade, payable: total - trade };
}

export interface DashboardQuoteRow {
  quoteId: string;
  customerId?: string | number;
  customerName: string;
  customerEmail: string;
  name: string;
  total: number;
  payable: number;
  status: QuoteStatus;
  updatedAt: number;
}

export interface HealthResponse {
  ok: boolean;
  configured?: boolean;
  dryRun?: boolean;
  needsSetup?: boolean;
  storeHash?: string;
}
