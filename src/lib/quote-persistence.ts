import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { fetchBigCommerceCatalogItem } from "@/lib/bigcommerce";
import { toCustomer } from "@/lib/db-mappers";
import type { Customer, DashboardQuoteRow, Quote, QuoteStatus, TemplatePriceNote, TemplateQuoteRow } from "@/types";
import { totals } from "@/types";

const VALID_STATUSES = new Set<QuoteStatus>(["draft", "sent", "accepted", "ordered"]);

type QuoteWithRelations = Awaited<ReturnType<typeof getQuoteRecord>>;
type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface SaveQuotePayload {
  quote: Quote;
  customer?: Customer | null;
}

export function isValidStatus(status: string): status is QuoteStatus {
  return VALID_STATUSES.has(status as QuoteStatus);
}

function validateQuote(quote: Quote) {
  if (!quote.name.trim()) throw new Error("Quote name is required.");
  if (!isValidStatus(quote.status)) throw new Error("Invalid quote status.");
  for (const item of quote.items) {
    if (!item.sku || !item.name || item.qty < 1 || item.priceCents < 0) {
      throw new Error("Invalid quote line item.");
    }
  }
  for (const tradein of quote.tradeins) {
    if (!tradein.label || tradein.amountCents <= 0) {
      throw new Error("Invalid trade-in.");
    }
  }
}

async function getQuoteRecord(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { orderBy: { id: "asc" } },
      tradeins: { orderBy: { id: "asc" } },
    },
  });
}

async function resolveCustomer(customer: Customer | null | undefined) {
  if (!customer) return null;

  const hasDetails = Boolean(
    customer.firstName ||
      customer.lastName ||
      customer.email ||
      customer.phone ||
      customer.city ||
      customer.region,
  );
  if (!hasDetails) return null;

  const base = {
    firstName: customer.firstName || "New",
    lastName: customer.lastName || "customer",
    email: customer.email || "",
    phone: customer.phone || "",
    street1: customer.street1 || "",
    city: customer.city || "",
    region: customer.region || "",
    postcode: customer.postcode || "",
    country: customer.country || "Australia",
    countryIso2: customer.countryIso2 || "AU",
  };

  if (typeof customer.id === "number") {
    return prisma.customer.upsert({
      where: { bigCommerceId: customer.id },
      update: base,
      create: { ...base, bigCommerceId: customer.id },
    });
  }

  if (typeof customer.id === "string" && customer.id) {
    const existing = await prisma.customer.findUnique({ where: { id: customer.id } });
    if (existing) {
      return prisma.customer.update({ where: { id: customer.id }, data: base });
    }
  }

  if (base.email) {
    const existing = await prisma.customer.findFirst({ where: { email: base.email } });
    if (existing) {
      return prisma.customer.update({ where: { id: existing.id }, data: base });
    }
  }

  return prisma.customer.create({ data: base });
}

export async function saveQuote(payload: SaveQuotePayload, mode: "create" | "update") {
  validateQuote(payload.quote);
  const customer = await resolveCustomer(payload.customer);
  const quote = payload.quote;

  const saved = await prisma.$transaction(async (tx) => {
    const existing = await tx.quote.findUnique({ where: { id: quote.id }, select: { quoteNo: true } });
    if (mode === "update") {
      if (!existing) throw new Error("Quote not found.");
    }
    const quoteNo = existing?.quoteNo ?? (mode === "create" ? await nextQuoteNo(tx) : null);

    await tx.quote.upsert({
      where: { id: quote.id },
      update: {
        name: quote.name,
        status: quote.status,
        isTemplate: false,
        quoteNo,
        checkoutUrl: quote.checkout?.url ?? null,
        customerId: customer?.id ?? null,
      },
      create: {
        id: quote.id,
        name: quote.name,
        status: quote.status,
        isTemplate: false,
        quoteNo,
        checkoutUrl: quote.checkout?.url ?? null,
        customerId: customer?.id ?? null,
      },
    });

    await tx.lineItem.deleteMany({ where: { quoteId: quote.id } });
    await tx.tradeIn.deleteMany({ where: { quoteId: quote.id } });

    for (const item of quote.items) {
      await tx.lineItem.create({
        data: {
          quoteId: quote.id,
          productId: item.productId,
          variantId: item.variantId,
          sku: item.sku,
          name: item.name,
          priceCents: item.priceCents,
          qty: item.qty,
        },
      });
    }

    for (const tradein of quote.tradeins) {
      await tx.tradeIn.create({
        data: {
          quoteId: quote.id,
          label: tradein.label,
          amountCents: tradein.amountCents,
        },
      });
    }

    return tx.quote.findUnique({
      where: { id: quote.id },
      include: { customer: true, items: { orderBy: { id: "asc" } }, tradeins: { orderBy: { id: "asc" } } },
    });
  });

  if (!saved) throw new Error("Quote not found.");
  return toQuoteResponse(saved);
}

export async function loadQuote(id: string) {
  const quote = await getQuoteRecord(id);
  if (!quote) return null;
  return toQuoteResponse(quote);
}

export async function saveQuoteAsTemplate(input: { name: string; quote: Quote }) {
  const name = input.name.trim();
  if (!name) throw new Error("Template name is required.");
  if (!input.quote.items.length) throw new Error("Add at least one item before saving a template.");

  validateQuote({ ...input.quote, name, status: "draft" });
  const templateId = randomUUID();
  const saved = await prisma.$transaction(async (tx) => {
    await tx.quote.create({
      data: {
        id: templateId,
        name,
        status: "draft",
        isTemplate: true,
        customerId: null,
        quoteNo: null,
        checkoutUrl: null,
        items: {
          create: input.quote.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            sku: item.sku,
            name: item.name,
            priceCents: item.priceCents,
            qty: item.qty,
          })),
        },
        tradeins: {
          create: input.quote.tradeins.map((tradein) => ({
            label: tradein.label,
            amountCents: tradein.amountCents,
          })),
        },
      },
    });

    return tx.quote.findUnique({
      where: { id: templateId },
      include: { customer: true, items: { orderBy: { id: "asc" } }, tradeins: { orderBy: { id: "asc" } } },
    });
  });

  if (!saved) throw new Error("Could not save template.");
  return toQuoteResponse(saved);
}

export async function listTemplates(): Promise<TemplateQuoteRow[]> {
  const templates = await prisma.quote.findMany({
    where: { isTemplate: true },
    include: {
      items: { orderBy: { id: "asc" } },
      tradeins: { orderBy: { id: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return templates.map((template) => ({
    quoteId: template.id,
    name: template.name,
    itemCount: template.items.length,
    tradeInCount: template.tradeins.length,
    updatedAt: template.updatedAt.getTime(),
  }));
}

export async function renameTemplate(id: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Template name is required.");
  const existing = await prisma.quote.findUnique({ where: { id }, select: { isTemplate: true } });
  if (!existing?.isTemplate) throw new Error("Template not found.");

  const template = await prisma.quote.update({
    where: { id },
    data: { name: trimmed },
    include: { customer: true, items: { orderBy: { id: "asc" } }, tradeins: { orderBy: { id: "asc" } } },
  });
  if (!template) throw new Error("Template not found.");
  return toQuoteResponse(template);
}

export async function createQuoteFromTemplate(id: string) {
  const template = await getQuoteRecord(id);
  if (!template || !template.isTemplate) throw new Error("Template not found.");

  const priceNotes: TemplatePriceNote[] = [];
  const refreshedItems = await Promise.all(
    template.items.map(async (item) => {
      try {
        const liveItem = await fetchBigCommerceCatalogItem({
          productId: item.productId,
          variantId: item.variantId,
          sku: item.sku,
        });
        return {
          productId: item.productId,
          variantId: item.variantId,
          sku: item.sku,
          name: item.name,
          priceCents: liveItem.priceCents,
          qty: item.qty,
        };
      } catch (error) {
        priceNotes.push({
          sku: item.sku,
          name: item.name,
          message: error instanceof Error
            ? `Using stored template price: ${error.message}`
            : "Using stored template price because live lookup failed.",
        });
        return {
          productId: item.productId,
          variantId: item.variantId,
          sku: item.sku,
          name: item.name,
          priceCents: item.priceCents,
          qty: item.qty,
        };
      }
    }),
  );

  const newQuoteId = randomUUID();
  const created = await prisma.$transaction(async (tx) => {
    const quoteNo = await nextQuoteNo(tx);
    await tx.quote.create({
      data: {
        id: newQuoteId,
        name: template.name,
        status: "draft",
        isTemplate: false,
        customerId: null,
        quoteNo,
        checkoutUrl: null,
        items: { create: refreshedItems },
        tradeins: {
          create: template.tradeins.map((tradein) => ({
            label: tradein.label,
            amountCents: tradein.amountCents,
          })),
        },
      },
    });

    return tx.quote.findUnique({
      where: { id: newQuoteId },
      include: { customer: true, items: { orderBy: { id: "asc" } }, tradeins: { orderBy: { id: "asc" } } },
    });
  });

  if (!created) throw new Error("Could not use template.");
  return { ...toQuoteResponse(created), priceNotes };
}

export async function updateQuoteStatus(id: string, status: QuoteStatus) {
  if (!isValidStatus(status)) throw new Error("Invalid quote status.");
  const quote = await prisma.quote
    .update({
      where: { id },
      data: { status },
      include: { customer: true, items: { orderBy: { id: "asc" } }, tradeins: { orderBy: { id: "asc" } } },
    })
    .catch(() => null);
  if (!quote) throw new Error("Quote not found.");
  return toQuoteResponse(quote);
}

export async function duplicateQuote(id: string) {
  const original = await getQuoteRecord(id);
  if (!original) throw new Error("Quote not found.");

  const newQuoteId = randomUUID();
  const duplicated = await prisma.$transaction(async (tx) => {
    const quoteNo = await nextQuoteNo(tx);
    await tx.quote.create({
      data: {
        id: newQuoteId,
        name: `${original.name} (copy)`,
        status: "draft",
        isTemplate: false,
        quoteNo,
        customerId: original.customerId,
        items: {
          create: original.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            sku: item.sku,
            name: item.name,
            priceCents: item.priceCents,
            qty: item.qty,
          })),
        },
        tradeins: {
          create: original.tradeins.map((tradein) => ({
            label: tradein.label,
            amountCents: tradein.amountCents,
          })),
        },
      },
    });

    return tx.quote.findUnique({
      where: { id: newQuoteId },
      include: { customer: true, items: { orderBy: { id: "asc" } }, tradeins: { orderBy: { id: "asc" } } },
    });
  });

  if (!duplicated) throw new Error("Could not duplicate quote.");
  return toQuoteResponse(duplicated);
}

export async function deleteQuote(id: string) {
  const existing = await prisma.quote.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) throw new Error("Quote not found.");

  const result = await deleteQuoteWithCascade(id).catch(() => deleteQuoteWithExplicitChildren(id));

  if (!result.cascadeVerified) {
    throw new Error("Quote deleted, but related line items or trade-ins could not be removed.");
  }

  return result;
}

async function deleteQuoteWithCascade(id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.quote.delete({ where: { id } });
    return verifyDeletedQuoteChildren(tx, id);
  });
}

async function deleteQuoteWithExplicitChildren(id: string) {
  return prisma.$transaction(async (tx) => {
    await tx.lineItem.deleteMany({ where: { quoteId: id } });
    await tx.tradeIn.deleteMany({ where: { quoteId: id } });
    await tx.quote.delete({ where: { id } });
    return verifyDeletedQuoteChildren(tx, id);
  });
}

async function verifyDeletedQuoteChildren(tx: PrismaTx, id: string) {
  const [remainingLineItems, remainingTradeIns] = await Promise.all([
    tx.lineItem.count({ where: { quoteId: id } }),
    tx.tradeIn.count({ where: { quoteId: id } }),
  ]);

  return {
    deletedQuoteId: id,
    cascadeVerified: remainingLineItems === 0 && remainingTradeIns === 0,
    remainingLineItems,
    remainingTradeIns,
  };
}

async function nextQuoteNo(tx: PrismaTx) {
  const rows = await tx.$queryRaw<Array<{ quote_no: string }>>`
    SELECT 'QT' || nextval('"Quote_quoteNo_seq"')::text AS quote_no
  `;
  const quoteNo = rows[0]?.quote_no;
  if (!quoteNo) throw new Error("Could not allocate quote number.");
  return quoteNo;
}

export async function listDashboardQuotes(): Promise<DashboardQuoteRow[]> {
  const quotes = await prisma.quote.findMany({
    where: { isTemplate: false },
    include: {
      customer: true,
      items: { orderBy: { id: "asc" } },
      tradeins: { orderBy: { id: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return quotes.map((quote) => {
    const shaped = toQuote(quote);
    const t = totals(shaped);
    const customerName = quote.customer
      ? `${quote.customer.firstName} ${quote.customer.lastName}`.trim() || "(no customer)"
      : "(no customer)";

    return {
      quoteId: quote.id,
      quoteNo: quote.quoteNo ?? undefined,
      customerId: quote.customerId ?? undefined,
      customerName,
      customerEmail: quote.customer?.email ?? "",
      name: quote.name,
      total: t.total,
      payable: t.payable,
      status: shaped.status,
      updatedAt: quote.updatedAt.getTime(),
    };
  });
}

function toQuoteResponse(record: NonNullable<QuoteWithRelations>) {
  return {
    quote: toQuote(record),
    customer: record.customer ? toCustomer(record.customer) : null,
  };
}

function toQuote(record: NonNullable<QuoteWithRelations>): Quote {
  const status = isValidStatus(record.status) ? record.status : "draft";
  return {
    id: record.id,
    name: record.name,
    status,
    isTemplate: record.isTemplate,
    items: record.items.map((item) => ({
      lid: item.id,
      productId: item.productId,
      variantId: item.variantId,
      sku: item.sku,
      name: item.name,
      priceCents: item.priceCents,
      qty: item.qty,
    })),
    tradeins: record.tradeins.map((tradein) => ({
      id: tradein.id,
      label: tradein.label,
      amountCents: tradein.amountCents,
    })),
    checkout: record.checkoutUrl ? { url: record.checkoutUrl } : null,
    quoteNo: record.quoteNo ?? undefined,
    saved: true,
    persisted: true,
  };
}
