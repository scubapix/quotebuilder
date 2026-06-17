"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { money, uid } from "@/lib/format";
import type { AppMode, CatalogItem, Customer, DashboardQuoteRow, LineItem, Quote } from "@/types";
import { totals } from "@/types";

const NEW_CUSTOMER: Customer = {
  id: null,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  street1: "",
  city: "",
  region: "",
  postcode: "",
  country: "Australia",
  countryIso2: "AU",
};

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normaliseCustomer(customer: Customer): Customer {
  return {
    id: customer.id ?? null,
    firstName: cleanText(customer.firstName),
    lastName: cleanText(customer.lastName),
    email: cleanText(customer.email),
    phone: cleanText(customer.phone),
    street1: cleanText(customer.street1),
    city: cleanText(customer.city),
    region: cleanText(customer.region),
    postcode: cleanText(customer.postcode),
    country: cleanText(customer.country) || "Australia",
    countryIso2: cleanText(customer.countryIso2) || "AU",
  };
}

function customerSummary(customer: Customer) {
  const c = normaliseCustomer(customer);
  const locality = [c.city, c.region, c.postcode].filter(Boolean).join(" ");
  const address = [c.street1, locality].filter(Boolean).join(", ");
  return [c.email, c.phone, address].filter(Boolean).join("  ·  ");
}

function newQuote(name = "System 1"): Quote {
  return {
    id: uid(),
    name,
    status: "draft",
    items: [],
    tradeins: [],
    checkout: null,
    saved: false,
    persisted: false,
  };
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-[17px] w-[17px] flex-none text-muted">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function BuilderPage() {
  const [activeView, setActiveView] = useState<"builder" | "quotes">("builder");
  const [mode, setMode] = useState<AppMode>("demo");
  const [customer, setCustomer] = useState<Customer>(NEW_CUSTOMER);
  const [quotes, setQuotes] = useState<Quote[]>(() => [newQuote()]);
  const [activeId, setActiveId] = useState<string>(() => "");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogItem[] | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [tradeLabel, setTradeLabel] = useState("");
  const [tradeAmount, setTradeAmount] = useState("");
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState<Customer>(NEW_CUSTOMER);
  const [customerSaving, setCustomerSaving] = useState(false);
  const [linkedCustomerId, setLinkedCustomerId] = useState<string | number | null>(null);
  const [dashboardRows, setDashboardRows] = useState<DashboardQuoteRow[]>([]);
  const [dashboardFilter, setDashboardFilter] = useState<"open" | "ordered">("open");
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; message: string } | null>(null);
  const [nowMs] = useState(() => Date.now());

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => r.json())
      .then((health: { mode?: AppMode }) => setMode(health.mode ?? "demo"))
      .catch(() => setMode("demo"));
  }, []);

  useEffect(() => {
    fetch("/api/quotes/index", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { quotes?: DashboardQuoteRow[] }) => setDashboardRows(data.quotes ?? []))
      .catch(() => setDashboardRows([]));
  }, []);

  useEffect(() => {
    fetch("/api/products/all", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { items?: CatalogItem[] }) => setCatalogue(data.items ?? null))
      .catch(() => setCatalogue(null));
  }, []);

  useEffect(() => {
    const q = search.trim();
    if (!q) return;

    const timer = window.setTimeout(() => {
      if (catalogue) {
        const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
        const filtered = catalogue
          .filter((item) => {
            const haystack = `${item.name} ${item.sku} ${item.cat} ${item.category}`.toLowerCase();
            return terms.every((term) => haystack.includes(term));
          })
          .slice(0, 8);
        setResults(filtered);
        setShowResults(true);
        return;
      }

      fetch(`/api/products/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data: { items?: CatalogItem[] }) => {
          setResults(data.items ?? []);
          setShowResults(true);
        })
        .catch(() => {
          setResults([]);
          setShowResults(true);
        });
    }, 200);

    return () => window.clearTimeout(timer);
  }, [catalogue, search]);

  useEffect(() => {
    const q = customerSearch.trim();
    if (q.length < 2) return;

    const timer = window.setTimeout(() => {
      fetch(`/api/customers/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data: { items?: Customer[] }) => setCustomerResults(data.items ?? []))
        .catch(() => setCustomerResults([]));
    }, 220);

    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  const activeQuote = quotes.find((quote) => quote.id === activeId) ?? quotes[0];
  const quoteTotals = useMemo(
    () => totals(activeQuote ?? { items: [], tradeins: [] }),
    [activeQuote],
  );
  const customerName =
    customer.firstName || customer.lastName
      ? `${customer.firstName} ${customer.lastName}`.trim()
      : "New customer";
  const customerDetail = customerSummary(customer);
  const openQuoteCount = dashboardRows.filter(
    (row) => row.status === "draft" || row.status === "sent",
  ).length;
  const filteredDashboardRows = dashboardRows
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .filter((row) =>
      dashboardFilter === "open"
        ? row.status === "draft" || row.status === "sent"
        : row.status === "ordered",
    )
    .filter((row) => {
      const q = dashboardSearch.toLowerCase();
      if (!q) return true;
      return `${row.customerName} ${row.name} ${row.customerEmail}`.toLowerCase().includes(q);
    });

  function updateActiveQuote(updater: (quote: Quote) => Quote) {
    if (!activeQuote) return;
    setQuotes((current) =>
      current.map((quote) => (quote.id === activeQuote.id ? updater(quote) : quote)),
    );
  }

  function addPart(part: CatalogItem) {
    if (!activeQuote || activeQuote.status !== "draft") return;
    updateActiveQuote((quote) => {
      const existing = quote.items.find(
        (item) => item.productId === part.productId && item.variantId === part.variantId,
      );
      if (existing) {
        return {
          ...quote,
          saved: false,
          items: quote.items.map((item) =>
            item.lid === existing.lid ? { ...item, qty: item.qty + 1 } : item,
          ),
        };
      }

      const item: LineItem = {
        lid: uid(),
        productId: part.productId,
        variantId: part.variantId,
        sku: part.sku,
        name: part.name,
        priceCents: part.priceCents,
        qty: 1,
      };

      return { ...quote, saved: false, items: [...quote.items, item] };
    });
    setSearch("");
    setResults([]);
    setShowResults(false);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (!value.trim()) {
      setResults([]);
      setShowResults(false);
    }
  }

  function handleCustomerSearchChange(value: string) {
    setCustomerSearch(value);
    if (value.trim().length < 2) {
      setCustomerResults([]);
    }
  }

  function openCustomerEditor(nextCustomer = customer) {
    const normalised = normaliseCustomer(nextCustomer);
    setCustomerForm(normalised);
    setLinkedCustomerId(normalised.id);
    setCustomerSearch("");
    setCustomerResults([]);
    setIsCustomerModalOpen(true);
  }

  function clearCustomerForm() {
    setCustomerForm(NEW_CUSTOMER);
    setLinkedCustomerId(null);
    setCustomerSearch("");
    setCustomerResults([]);
  }

  function updateCustomerForm(field: keyof Customer, value: string) {
    setCustomerForm((current) => ({
      ...current,
      [field]: value,
    }));
    if (field === "firstName" || field === "lastName" || field === "email") {
      setLinkedCustomerId(null);
    }
  }

  function pickCustomer(result: Customer) {
    const normalised = normaliseCustomer(result);
    setCustomerForm(normalised);
    setLinkedCustomerId(normalised.id);
    setCustomerSearch("");
    setCustomerResults([]);
  }

  async function saveCustomer() {
    const form = normaliseCustomer({ ...customerForm, id: linkedCustomerId });
    if (!form.firstName || !form.email) {
      setBanner({ kind: "err", message: "A first name and email are needed to save the customer." });
      return;
    }

    setCustomerSaving(true);
    setBanner(null);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer: form }),
      });
      const data = (await response.json()) as { customer?: Customer; dryRun?: boolean; error?: string };
      if (!response.ok || !data.customer) throw new Error(data.error || "Could not save customer.");

      const savedCustomer = normaliseCustomer(data.customer);
      setCustomer(savedCustomer);
      setLinkedCustomerId(savedCustomer.id);
      setIsCustomerModalOpen(false);
      updateActiveQuote((quote) => ({ ...quote, saved: false }));
      setBanner({
        kind: "ok",
        message: data.dryRun ? "Dry run: customer linked, no BigCommerce write made." : "Customer saved and linked.",
      });
    } catch (error) {
      setBanner({
        kind: "err",
        message: error instanceof Error ? error.message : "Could not save customer.",
      });
    } finally {
      setCustomerSaving(false);
    }
  }

  function updateQty(lid: string, qty: number) {
    updateActiveQuote((quote) => ({
      ...quote,
      saved: false,
      items: quote.items.map((item) =>
        item.lid === lid ? { ...item, qty: Math.max(1, Math.floor(qty) || 1) } : item,
      ),
    }));
  }

  function removeItem(lid: string) {
    updateActiveQuote((quote) => ({
      ...quote,
      saved: false,
      items: quote.items.filter((item) => item.lid !== lid),
    }));
  }

  function addTradeIn() {
    const label = tradeLabel.trim();
    const amountCents = Math.round((Number(tradeAmount) || 0) * 100);
    if (!label || amountCents <= 0) return;
    updateActiveQuote((quote) => ({
      ...quote,
      saved: false,
      tradeins: [...quote.tradeins, { id: uid(), label, amountCents }],
    }));
    setTradeLabel("");
    setTradeAmount("");
    setShowTradeForm(false);
  }

  function removeTradeIn(id: string) {
    updateActiveQuote((quote) => ({
      ...quote,
      saved: false,
      tradeins: quote.tradeins.filter((tradein) => tradein.id !== id),
    }));
  }

  function addQuote() {
    const quote = newQuote(`System ${quotes.length + 1}`);
    setQuotes((current) => [...current, quote]);
    setActiveId(quote.id);
  }

  function duplicateQuote() {
    if (!activeQuote) return;
    const copy: Quote = {
      ...newQuote(`${activeQuote.name} (variant)`),
      items: activeQuote.items.map((item) => ({ ...item, lid: uid() })),
      tradeins: activeQuote.tradeins.map((tradein) => ({ ...tradein, id: uid() })),
    };
    setQuotes((current) => [...current, copy]);
    setActiveId(copy.id);
  }

  async function refreshDashboard() {
    const response = await fetch("/api/quotes/index", { cache: "no-store" });
    const data = (await response.json()) as { quotes?: DashboardQuoteRow[] };
    setDashboardRows(data.quotes ?? []);
  }

  async function saveActiveQuote() {
    if (!activeQuote || !activeQuote.items.length) return;

    setSaving(true);
    setBanner(null);
    try {
      const response = await fetch(
        activeQuote.persisted ? `/api/quotes/${encodeURIComponent(activeQuote.id)}` : "/api/quotes",
        {
          method: activeQuote.persisted ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quote: activeQuote, customer }),
        },
      );
      const data = (await response.json()) as {
        quote?: Quote;
        customer?: Customer | null;
        error?: string;
      };
      if (!response.ok || !data.quote) throw new Error(data.error || "Could not save quote.");

      setQuotes((current) =>
        current.map((quote) => (quote.id === activeQuote.id ? data.quote! : quote)),
      );
      if (data.customer) setCustomer(data.customer);
      setActiveId(data.quote.id);
      await refreshDashboard();
      setBanner({ kind: "ok", message: "Quote saved to SQLite." });
    } catch (error) {
      setBanner({
        kind: "err",
        message: error instanceof Error ? error.message : "Could not save quote.",
      });
    } finally {
      setSaving(false);
    }
  }

  function downloadPdf() {
    if (!activeQuote?.persisted) {
      setBanner({ kind: "err", message: "Save the quote before downloading a PDF." });
      return;
    }
    window.open(`/api/quotes/${encodeURIComponent(activeQuote.id)}/pdf`, "_blank", "noopener,noreferrer");
  }

  async function emailActiveQuote() {
    if (!activeQuote?.persisted) {
      setBanner({ kind: "err", message: "Save the quote before emailing it." });
      return;
    }

    setEmailing(true);
    setBanner(null);
    try {
      const response = await fetch(`/api/quotes/${encodeURIComponent(activeQuote.id)}/email`, {
        method: "POST",
      });
      const data = (await response.json()) as { dryRun?: boolean; sent?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not email quote.");
      setBanner({
        kind: "ok",
        message: data.dryRun
          ? "Dry run: quote email was not sent, but the PDF attachment was rendered."
          : "Quote emailed to customer.",
      });
      if (data.sent) {
        const loaded = await fetch(`/api/quotes/${encodeURIComponent(activeQuote.id)}`, { cache: "no-store" });
        const loadedData = (await loaded.json()) as { quote?: Quote; customer?: Customer | null };
        if (loadedData.quote) {
          setQuotes((current) =>
            current.map((quote) => (quote.id === loadedData.quote!.id ? loadedData.quote! : quote)),
          );
        }
      }
    } catch (error) {
      setBanner({
        kind: "err",
        message: error instanceof Error ? error.message : "Could not email quote.",
      });
    } finally {
      setEmailing(false);
    }
  }

  async function openDashboardQuote(quoteId: string) {
    const response = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}`, { cache: "no-store" });
    const data = (await response.json()) as { quote?: Quote; customer?: Customer | null };
    if (!response.ok || !data.quote) return;

    setQuotes((current) => {
      const exists = current.some((quote) => quote.id === data.quote!.id);
      return exists
        ? current.map((quote) => (quote.id === data.quote!.id ? data.quote! : quote))
        : [...current, data.quote!];
    });
    if (data.customer) setCustomer(data.customer);
    setActiveId(data.quote.id);
    setActiveView("builder");
  }

  function openQuotesView() {
    setActiveView("quotes");
    void refreshDashboard();
  }

  function formatWhen(timestamp: number) {
    if (!timestamp) return "";
    const days = Math.floor((nowMs - timestamp) / 86_400_000);
    if (days <= 0) return "today";
    if (days === 1) return "1 day ago";
    return `${days} days ago`;
  }

  return (
    <>
      <AppHeader
        activeView={activeView}
        mode={mode}
        openQuoteCount={openQuoteCount}
        onNavBuilder={() => setActiveView("builder")}
        onNavQuotes={openQuotesView}
      />

      {activeView === "builder" && activeQuote ? (
        <div className="grid items-start lg:grid-cols-[300px_1fr]">
          <aside className="min-h-[calc(100vh-56px)] border-line bg-card p-[18px] lg:border-r max-lg:min-h-0 max-lg:border-b">
            <button
              type="button"
              onClick={() => openCustomerEditor()}
              className="mb-5 w-full rounded-[var(--radius)] bg-deep p-3.5 text-left text-[#DCEFEf]"
            >
              <div className="font-display text-[15px] font-semibold text-white">{customerName}</div>
              <div className="mt-0.5 break-words text-xs leading-normal text-[#9FC4CE]">
                {customerDetail || "No details yet"}
              </div>
              <div className="mt-2.5 inline-flex rounded-md border border-white/16 bg-white/10 px-2.5 py-1.5 text-[11.5px] text-[#CFE9E8]">
                {customer.id ? "Add / edit customer" : "New customer"}
              </div>
            </button>

            <h3 className="mb-[11px] font-display text-[11px] uppercase tracking-[0.6px] text-muted">
              Quotes for this customer
            </h3>

            <div className="flex flex-col gap-2">
              {quotes.map((quote) => {
                const t = totals(quote);
                return (
                  <button
                    key={quote.id}
                    type="button"
                    onClick={() => setActiveId(quote.id)}
                    className={`cursor-pointer rounded-[var(--radius-sm)] border p-3 text-left ${
                      quote.id === activeQuote.id ? "border-teal bg-teal-bg" : "border-line bg-card"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-[13.5px] font-semibold text-ink-text">
                        {quote.name}
                      </span>
                      <span className="font-mono text-[12.5px] text-ink-text">{money(t.total)}</span>
                    </div>
                    <div className="mt-[5px] flex justify-between text-[11px] text-muted">
                      <span>
                        {quote.items.length} part{quote.items.length === 1 ? "" : "s"}
                        {quote.saved && (
                          <span className="ml-1 rounded-full bg-teal-bg px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.3px] text-teal-dk">
                            saved
                          </span>
                        )}
                      </span>
                      <StatusPill status={quote.status} />
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={addQuote}
              className="mt-3.5 w-full cursor-pointer rounded-[var(--radius-sm)] border border-dashed border-line bg-card px-2.5 py-2.5 font-display text-[13px] font-medium text-teal-dk hover:border-teal hover:bg-teal-bg"
            >
              + New system / quote
            </button>
          </aside>

          <main className="max-w-[880px] px-6 pb-[90px] pt-[22px] max-lg:px-[18px]">
            {banner && (
              <div
                className={`mb-4 flex gap-2.5 rounded-[var(--radius-sm)] border px-3.5 py-[11px] text-[13px] ${
                  banner.kind === "ok"
                    ? "border-[#BFE0CC] bg-[#ECF6F0] text-[#1E5E3D]"
                    : "border-[#ECC4C9] bg-[#FBEDEE] text-[#8C2733]"
                }`}
              >
                <span className="font-mono font-semibold">{banner.kind === "ok" ? "✓" : "!"}</span>
                <span>{banner.message}</span>
              </div>
            )}

            <div className="relative mb-5">
              <div className="flex items-center gap-2.5 rounded-[var(--radius)] border border-line bg-card px-3.5 py-[11px] shadow-card focus-within:border-teal focus-within:shadow-[0_0_0_3px_rgba(14,124,123,0.12)]">
                <SearchIcon />
                <input
                  value={search}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  onFocus={() => search.trim() && setShowResults(true)}
                  className="w-full border-none bg-transparent font-body text-[14.5px] text-ink-text outline-none"
                  placeholder='Search catalogue — try “housing”, “strobe”, “72501”, “Sony”…'
                  autoComplete="off"
                />
              </div>
              {showResults && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-[380px] overflow-y-auto rounded-[var(--radius)] border border-line bg-card shadow-[0_18px_44px_-18px_rgba(14,34,48,0.4)]">
                  {results.length ? (
                    results.map((part) => (
                      <button
                        key={part.sku}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => addPart(part)}
                        className="flex w-full cursor-pointer items-center gap-3 border-b border-[#F0F3F5] px-3.5 py-[11px] text-left last:border-b-0 hover:bg-teal-bg"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-ink-text">
                            {part.name}
                          </span>
                          <span className="mt-0.5 block font-mono text-[11px] text-muted">
                            {part.sku} · {part.category}
                          </span>
                        </span>
                        <span className="flex-none font-mono text-[13px] text-ink-text">
                          {money(part.priceCents)}
                        </span>
                        <span className="grid h-[26px] w-[26px] flex-none place-items-center rounded-md border border-line bg-card text-[17px] leading-none text-teal-dk">
                          +
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-4 text-center text-[13px] text-muted">
                      No matching products.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mb-1.5 flex items-start gap-3.5">
              <input
                value={activeQuote.name}
                onChange={(event) =>
                  updateActiveQuote((quote) => ({ ...quote, saved: false, name: event.target.value }))
                }
                className="w-full border-b-[1.5px] border-transparent bg-transparent px-0 py-0.5 font-display text-[22px] font-semibold text-ink outline-none hover:border-line focus:border-teal"
              />
              <StatusPill status={activeQuote.status} />
            </div>

            <div className="mb-[18px] font-mono text-[12.5px] text-muted">
              {activeQuote.items.length} part{activeQuote.items.length === 1 ? "" : "s"}
              {activeQuote.items.length > 0 &&
                `  ·  ${activeQuote.items
                  .map((item) => item.sku || item.name.split(" ")[0])
                  .slice(0, 6)
                  .join(" + ")}${activeQuote.items.length > 6 ? " …" : ""}`}
            </div>

            <div className="overflow-hidden rounded-[var(--radius)] border border-line bg-card shadow-card">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-line bg-[#F8FAFB]">
                    <th className="w-[52%] px-3.5 py-[11px] text-left text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted">
                      Part
                    </th>
                    <th className="w-[12%] px-3.5 py-[11px] text-right text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted">
                      Qty
                    </th>
                    <th className="w-[16%] px-3.5 py-[11px] text-right text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted">
                      Unit (ex GST)
                    </th>
                    <th className="w-[16%] px-3.5 py-[11px] text-right text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted">
                      Line
                    </th>
                    <th className="w-[4%]" />
                  </tr>
                </thead>
                <tbody>
                  {activeQuote.items.map((item) => (
                    <tr key={item.lid}>
                      <td className="border-b border-[#F0F3F5] px-3.5 py-[11px]">
                        <div className="text-[13.5px] font-[450] text-ink-text">{item.name}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-muted">{item.sku}</div>
                      </td>
                      <td className="border-b border-[#F0F3F5] px-3.5 py-[11px] text-right">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={item.qty}
                          onChange={(event) => updateQty(item.lid, Number(event.target.value))}
                          className="num w-[58px] rounded-md border border-line px-2 py-1.5 text-right text-[13px]"
                        />
                      </td>
                      <td className="num border-b border-[#F0F3F5] px-3.5 py-[11px] text-right text-[13px]">
                        {money(item.priceCents)}
                      </td>
                      <td className="border-b border-[#F0F3F5] px-3.5 py-[11px] text-right">
                        <span className="num text-[13.5px]">{money(item.qty * item.priceCents)}</span>
                      </td>
                      <td className="border-b border-[#F0F3F5] px-3.5 py-[11px]">
                        <button
                          type="button"
                          onClick={() => removeItem(item.lid)}
                          className="rounded border-none bg-transparent px-[7px] py-1 text-[17px] text-muted hover:bg-[#FBEDEE] hover:text-red"
                          title="Remove"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {activeQuote.items.length === 0 ? (
                <div className="px-4 py-[34px] text-center text-[13.5px] text-muted">
                  <b className="mb-1 block font-display text-ink-text">No parts yet</b>
                  Search above and add housings, ports, strobes and arms to build this system.
                </div>
              ) : (
                <>
                  <div className="border-t border-line bg-[#F8FAFB] px-4 py-3.5">
                    <div className="flex justify-between py-[3px] text-[13.5px] text-muted">
                      <span>Subtotal (ex GST)</span>
                      <span className="num text-ink-text">{money(quoteTotals.sub)}</span>
                    </div>
                    <div className="flex justify-between py-[3px] text-[13.5px] text-muted">
                      <span>GST 10%</span>
                      <span className="num text-ink-text">{money(quoteTotals.gst)}</span>
                    </div>
                    {quoteTotals.trade > 0 && (
                      <>
                        <div className="flex justify-between py-[3px] text-[13.5px] text-muted">
                          <span>Total (inc GST)</span>
                          <span className="num text-ink-text">{money(quoteTotals.total)}</span>
                        </div>
                        {activeQuote.tradeins.map((tradein) => (
                          <div
                            key={tradein.id}
                            className="flex justify-between py-[3px] text-[13.5px] text-muted"
                          >
                            <span>
                              Less: {tradein.label}{" "}
                              <button
                                type="button"
                                onClick={() => removeTradeIn(tradein.id)}
                                className="text-muted hover:text-red"
                              >
                                ×
                              </button>
                            </span>
                            <span className="num text-red">−{money(tradein.amountCents)}</span>
                          </div>
                        ))}
                      </>
                    )}
                    <div className="mt-1.5 flex justify-between border-t border-line pt-2.5 text-ink">
                      <span className="font-display text-[15px] font-semibold">
                        {quoteTotals.trade > 0 ? "Amount payable" : "Total (inc GST)"}
                      </span>
                      <span className="num text-xl font-semibold">
                        {money(quoteTotals.trade > 0 ? quoteTotals.payable : quoteTotals.total)}
                      </span>
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    <button
                      type="button"
                      onClick={() => setShowTradeForm(true)}
                      className="bg-transparent px-0 py-1 font-display text-[12.5px] font-medium text-teal-dk hover:underline"
                    >
                      + Add trade-in / allowance
                    </button>
                    {showTradeForm && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          value={tradeLabel}
                          onChange={(event) => setTradeLabel(event.target.value)}
                          placeholder="e.g. Trade-in: NA-A7IV housing"
                          className="min-w-[150px] flex-1 rounded-md border border-line px-2.5 py-2 text-[13.5px] outline-none focus:border-teal"
                        />
                        <input
                          value={tradeAmount}
                          onChange={(event) => setTradeAmount(event.target.value)}
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Amount $"
                          className="max-w-[130px] rounded-md border border-line px-2.5 py-2 text-[13.5px] outline-none focus:border-teal"
                        />
                        <button
                          type="button"
                          onClick={addTradeIn}
                          className="rounded-[var(--radius-sm)] bg-teal px-3.5 py-2.5 font-display text-[13.5px] font-semibold text-white"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowTradeForm(false)}
                          className="rounded-[var(--radius-sm)] border border-line bg-card px-3 py-2.5 font-display text-[13.5px] font-semibold text-ink-2"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="mt-[18px] flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={duplicateQuote}
                className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-card px-[18px] py-[11px] font-display text-[13.5px] font-semibold text-ink-2"
              >
                Duplicate as variant
              </button>
              <button
                type="button"
                onClick={saveActiveQuote}
                disabled={!activeQuote.items.length || saving || Boolean(activeQuote.saved)}
                className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-card px-[18px] py-[11px] font-display text-[13.5px] font-semibold text-ink-2 disabled:opacity-45"
              >
                {saving ? "Saving..." : activeQuote.saved ? "Saved ✓" : "Save quote"}
              </button>
              <button
                type="button"
                onClick={downloadPdf}
                disabled={!activeQuote.persisted}
                className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-card px-[18px] py-[11px] font-display text-[13.5px] font-semibold text-ink-2 disabled:opacity-45"
              >
                Download PDF
              </button>
              <span className="flex-1" />
              <button
                type="button"
                onClick={emailActiveQuote}
                disabled={!activeQuote.items.length || emailing}
                className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-amber px-[18px] py-[11px] font-display text-[13.5px] font-semibold text-white disabled:opacity-45"
              >
                {emailing ? "Emailing..." : "Email to customer"}
              </button>
              <button
                type="button"
                disabled
                className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-teal px-[18px] py-[11px] font-display text-[13.5px] font-semibold text-white opacity-45"
              >
                Accept → order
              </button>
            </div>

            <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
              Demo mode uses seeded Scubapix products and customers so you can try the flow with no
              BigCommerce or SMTP credentials. Live catalogue, email, PDF, and checkout wiring land
              in later checkpoints.
            </p>
          </main>
        </div>
      ) : (
        <div className="mx-auto max-w-[1000px] px-[22px] pb-20 pt-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
            <h2 className="m-0 font-display text-[22px] font-semibold text-ink">Open quotes</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDashboardFilter("open")}
                className={`rounded-full border px-[13px] py-[7px] font-display text-[12.5px] font-medium ${
                  dashboardFilter === "open"
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-card text-ink-2"
                }`}
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setDashboardFilter("ordered")}
                className={`rounded-full border px-[13px] py-[7px] font-display text-[12.5px] font-medium ${
                  dashboardFilter === "ordered"
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-card text-ink-2"
                }`}
              >
                Ordered
              </button>
              <input
                value={dashboardSearch}
                onChange={(event) => setDashboardSearch(event.target.value)}
                placeholder="Filter by customer or system..."
                className="min-w-[200px] rounded-full border border-line px-3 py-2 text-[13px] outline-none focus:border-teal"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-[var(--radius)] border border-line bg-card shadow-card">
            <div className="grid grid-cols-[1.4fr_1.6fr_0.9fr_0.9fr_0.8fr] gap-2.5 border-b border-[#F0F3F5] bg-[#F8FAFB] px-4 py-[13px] text-[10.5px] font-semibold uppercase tracking-[0.5px] text-muted">
              <span>Customer</span>
              <span>System</span>
              <span className="text-right">Total</span>
              <span className="text-right">Status</span>
              <span className="text-right">Updated</span>
            </div>

            {filteredDashboardRows.length ? (
              filteredDashboardRows.map((row) => (
                <button
                  key={row.quoteId}
                  type="button"
                  onClick={() => openDashboardQuote(row.quoteId)}
                  className="grid w-full cursor-pointer grid-cols-[1.4fr_1.6fr_0.9fr_0.9fr_0.8fr] items-center gap-2.5 border-b border-[#F0F3F5] px-4 py-[13px] text-left last:border-b-0 hover:bg-teal-bg"
                >
                  <span className="font-medium text-ink-text">{row.customerName || "—"}</span>
                  <span className="text-[13px] text-muted">{row.name}</span>
                  <span className="num text-right text-[13px]">{money(row.payable ?? row.total)}</span>
                  <span className="text-right">
                    <StatusPill status={row.status} />
                  </span>
                  <span className="text-right text-xs text-muted">{formatWhen(row.updatedAt)}</span>
                </button>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-muted">
                No quotes here yet. Build one in the Builder, then Save it — it&apos;ll appear here.
              </div>
            )}
          </div>
        </div>
      )}
      {isCustomerModalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(8,22,30,0.5)] p-[18px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsCustomerModalOpen(false);
          }}
        >
          <div className="w-full max-w-[520px] rounded-[14px] bg-card p-5 shadow-[0_30px_80px_-20px_rgba(8,22,30,0.5)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0 font-display text-[17px] font-semibold text-ink">Customer details</h3>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="border-none bg-transparent px-1 text-2xl leading-none text-muted hover:text-ink-text"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.4px] text-muted">
              Find an existing customer
            </label>
            <div className="relative mb-3.5">
              <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-[#F8FAFB] px-3 py-2.5 focus-within:border-teal focus-within:bg-card focus-within:shadow-[0_0_0_3px_rgba(14,124,123,0.12)]">
                <SearchIcon />
                <input
                  value={customerSearch}
                  onChange={(event) => handleCustomerSearchChange(event.target.value)}
                  placeholder="Start typing a name or email..."
                  className="w-full border-none bg-transparent text-sm outline-none"
                  autoComplete="off"
                />
              </div>
              {customerSearch.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-[calc(100%+5px)] z-10 max-h-60 overflow-y-auto rounded-[var(--radius-sm)] border border-line bg-card shadow-[0_16px_40px_-16px_rgba(8,22,30,0.4)]">
                  {customerResults.length ? (
                    customerResults.map((result) => (
                      <button
                        key={String(result.id)}
                        type="button"
                        onClick={() => pickCustomer(result)}
                        className="block w-full border-b border-[#F0F3F5] px-3 py-2 text-left last:border-b-0 hover:bg-teal-bg"
                      >
                        <span className="block text-[13.5px] font-medium text-ink-text">
                          {result.firstName} {result.lastName}
                        </span>
                        <span className="mt-px block text-[11.5px] text-muted">
                          {[result.email, result.city, result.region].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-3 text-center text-[12.5px] text-muted">
                      No matching customer — fill the fields below to add a new one.
                    </div>
                  )}
                </div>
              )}
            </div>

            {linkedCustomerId && (
              <div className="mb-3.5 rounded-[var(--radius-sm)] border border-[#BFE0DE] bg-teal-bg px-3 py-2 text-xs text-teal-dk">
                ✓ Linked to existing customer <b className="font-mono">#{linkedCustomerId}</b>
              </div>
            )}

            <div className="mb-4 grid grid-cols-2 gap-2.5">
              <input
                value={customerForm.firstName}
                onChange={(event) => updateCustomerForm("firstName", event.target.value)}
                placeholder="First name"
                className="rounded-[var(--radius-sm)] border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <input
                value={customerForm.lastName}
                onChange={(event) => updateCustomerForm("lastName", event.target.value)}
                placeholder="Last name"
                className="rounded-[var(--radius-sm)] border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <input
                value={customerForm.email}
                onChange={(event) => updateCustomerForm("email", event.target.value)}
                placeholder="Email"
                className="rounded-[var(--radius-sm)] border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <input
                value={customerForm.phone}
                onChange={(event) => updateCustomerForm("phone", event.target.value)}
                placeholder="Phone"
                className="rounded-[var(--radius-sm)] border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <input
                value={customerForm.street1}
                onChange={(event) => updateCustomerForm("street1", event.target.value)}
                placeholder="Street address"
                className="col-span-2 rounded-[var(--radius-sm)] border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <input
                value={customerForm.city}
                onChange={(event) => updateCustomerForm("city", event.target.value)}
                placeholder="City / suburb"
                className="rounded-[var(--radius-sm)] border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <input
                value={customerForm.region}
                onChange={(event) => updateCustomerForm("region", event.target.value)}
                placeholder="State (e.g. QLD)"
                className="rounded-[var(--radius-sm)] border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <input
                value={customerForm.postcode}
                onChange={(event) => updateCustomerForm("postcode", event.target.value)}
                placeholder="Postcode"
                className="rounded-[var(--radius-sm)] border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <input
                value={customerForm.country}
                onChange={(event) => updateCustomerForm("country", event.target.value)}
                placeholder="Country"
                className="rounded-[var(--radius-sm)] border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <input
                value={customerForm.countryIso2}
                onChange={(event) => updateCustomerForm("countryIso2", event.target.value.toUpperCase())}
                placeholder="Country code"
                className="rounded-[var(--radius-sm)] border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearCustomerForm}
                className="rounded-[var(--radius-sm)] border border-line bg-card px-4 py-2.5 font-display text-[13.5px] font-semibold text-ink-2"
              >
                Clear / new
              </button>
              <span className="flex-1" />
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="rounded-[var(--radius-sm)] border border-line bg-card px-4 py-2.5 font-display text-[13.5px] font-semibold text-ink-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCustomer}
                disabled={customerSaving}
                className="rounded-[var(--radius-sm)] bg-teal px-4 py-2.5 font-display text-[13.5px] font-semibold text-white disabled:opacity-45"
              >
                {customerSaving ? "Saving..." : "Save customer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
