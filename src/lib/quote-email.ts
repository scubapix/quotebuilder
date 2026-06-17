import nodemailer from "nodemailer";
import { getAppMode } from "@/lib/app-mode";
import { prisma } from "@/lib/prisma";
import type { Customer, Quote } from "@/types";

interface EmailQuoteInput {
  quote: Quote;
  customer: Customer | null;
  pdf: Buffer;
  filename: string;
}

export async function emailQuote({ quote, customer, pdf, filename }: EmailQuoteInput) {
  if (!customer?.email) {
    throw new Error("Quote customer has no email address.");
  }

  const systemName = quote.name || "Your underwater imaging system";
  const quoteNumber = quote.quoteNo || quote.id.slice(0, 8).toUpperCase();
  const subject = `Your Scubapix quote — ${systemName} (${quoteNumber})`;
  const ctaUrl = quoteCartUrl(quote.id);
  const text = quoteEmailText({ systemName, quoteNumber, ctaUrl });
  const html = quoteEmailHtml({ systemName, quoteNumber, ctaUrl });
  const mode = getAppMode();

  if (mode !== "live") {
    console.info("Quote email dry-run", {
      mode,
      to: customer.email,
      subject,
      cartCtaUrl: ctaUrl,
      pdfBytes: pdf.length,
      multipart: { html: true, text: true },
    });
    return { sent: false, dryRun: true, to: customer.email, subject, cartCtaUrl: ctaUrl, pdfBytes: pdf.length };
  }

  const smtp = await smtpConfig();
  if (!smtp.host || !smtp.from || !smtp.user || !process.env.SMTP_PASS) {
    throw new Error("SMTP is not configured.");
  }

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: process.env.SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: smtp.from,
    to: customer.email,
    subject,
    text,
    html,
    attachments: [{ filename, content: pdf, contentType: "application/pdf" }],
  });

  if (quote.status === "draft") {
    await prisma.quote.update({ where: { id: quote.id }, data: { status: "sent" } });
  }

  return { sent: true, dryRun: false, to: customer.email, subject };
}

async function smtpConfig() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } }).catch(() => null);
  return {
    host: process.env.SMTP_HOST || settings?.smtpHost || "",
    port: Number(process.env.SMTP_PORT || settings?.smtpPort || 587),
    from: process.env.SMTP_FROM || settings?.smtpFrom || "",
    user: process.env.SMTP_USER || settings?.smtpUser || "",
  };
}

function quoteCartUrl(quoteId: string) {
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${appUrl}/quote/${encodeURIComponent(quoteId)}/cart`;
}

function quoteEmailText({ ctaUrl }: { systemName: string; quoteNumber: string; ctaUrl: string }) {
  return `Hello,

Thanks for your interest in building your underwater imaging system with Scubapix. Your quote is attached as a PDF — it lists each item, the configuration we discussed, and the total including GST.

When you're ready to go ahead, just click the button below. It'll load this exact system into your cart so you can review everything and complete your order online — no need to re-add the items yourself.

Add this system to cart:
${ctaUrl}

If you'd like to make any changes first, or have questions about any of the gear, simply reply to this email and we'll sort it out with you.

A quick note: prices are current as of the date on your quote and may change with supplier pricing and stock availability, so we'd recommend completing your order while the quote is valid.

Thanks again for choosing Scubapix — Australia's Nauticam specialists.

Warm regards,
The Scubapix Team
07 4031 7655 · info@scubapix.com · scubapix.com`;
}

function quoteEmailHtml({ ctaUrl }: { systemName: string; quoteNumber: string; ctaUrl: string }) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;color:#16242E;line-height:1.5">
      <p>Hello,</p>
      <p>Thanks for your interest in building your underwater imaging system with Scubapix. Your quote is attached as a PDF &mdash; it lists each item, the configuration we discussed, and the total including GST.</p>
      <p>When you're ready to go ahead, just click the button below. It'll load this exact system into your cart so you can review everything and complete your order online &mdash; no need to re-add the items yourself.</p>
      <p style="margin:24px 0">
        <a href="${escapeAttribute(ctaUrl)}" style="display:inline-block;background:#0E7C7B;color:#ffffff;text-decoration:none;font-weight:700;border-radius:7px;padding:12px 18px">
          Add this system to cart
        </a>
      </p>
      <p>If you'd like to make any changes first, or have questions about any of the gear, simply reply to this email and we'll sort it out with you.</p>
      <p>A quick note: prices are current as of the date on your quote and may change with supplier pricing and stock availability, so we'd recommend completing your order while the quote is valid.</p>
      <p>Thanks again for choosing Scubapix &mdash; Australia's Nauticam specialists.</p>
      <p>Warm regards,<br>The Scubapix Team<br>07 4031 7655 &middot; info@scubapix.com &middot; scubapix.com</p>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
