import PDFDocument from "pdfkit";
import path from "node:path";
import type { Customer, Quote } from "@/types";
import { money } from "@/lib/format";
import { totals } from "@/types";

interface QuotePdfInput {
  quote: Quote;
  customer: Customer | null;
}

const INK = "#0E2230";
const TEAL = "#0E7C7B";
const TEXT = "#16242E";
const MUTED = "#62707B";
const LINE = "#DCE3E7";
const RED = "#B23A48";

const FONT_REGULAR = "Roboto";
const FONT_BOLD = "Roboto-Bold";
const FONT_MONO = "Roboto-Mono";
const FONT_MONO_BOLD = "Roboto-Mono-Bold";

const FONT_PATHS = {
  regular: fontPath("@expo-google-fonts", "roboto", "400Regular", "Roboto_400Regular.ttf"),
  bold: fontPath("@expo-google-fonts", "roboto", "700Bold", "Roboto_700Bold.ttf"),
  mono: fontPath("@expo-google-fonts", "roboto-mono", "400Regular", "RobotoMono_400Regular.ttf"),
  monoBold: fontPath("@expo-google-fonts", "roboto-mono", "700Bold", "RobotoMono_700Bold.ttf"),
};

export async function renderQuotePdf(input: QuotePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 45, font: FONT_PATHS.regular });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    registerQuoteFonts(doc);
    drawQuote(doc, input);
    doc.end();
  });
}

export function quotePdfFilename(quote: Quote, customer: Customer | null) {
  const quoteNo = quote.quoteNo || quote.id.slice(0, 8);
  const lastName = (customer?.lastName || "customer").replace(/\W+/g, "");
  return `Scubapix-Quote-${quoteNo}-${lastName}.pdf`;
}

function drawQuote(doc: PDFKit.PDFDocument, { quote, customer }: QuotePdfInput) {
  const t = totals(quote);
  const today = new Date();
  const valid = new Date(today.getTime() + 30 * 86_400_000);
  const quoteNo = quote.quoteNo || quote.id.slice(0, 8).toUpperCase();
  const pageWidth = doc.page.width;
  const margin = 45;
  const right = pageWidth - margin;

  doc.rect(0, 0, pageWidth, 85).fill(INK);
  doc.rect(0, 85, pageWidth, 5).fill(TEAL);

  doc.fillColor("#FFFFFF").font(FONT_BOLD).fontSize(24).text("SCUBAPIX", margin, 26);
  doc.fillColor("#96B4C4").font(FONT_REGULAR).fontSize(10).text("Nauticam Australia", margin, 55);
  doc.fillColor("#FFFFFF").font(FONT_BOLD).fontSize(18).text("QUOTE", margin, 26, {
    align: "right",
  });
  doc.fillColor("#AAC3CF").font(FONT_MONO).fontSize(10);
  doc.text(quoteNo, margin, 51, { align: "right" });
  doc.text(formatDate(today), margin, 66, { align: "right" });

  doc.fillColor(MUTED).font(FONT_REGULAR).fontSize(9);
  doc.text("Suite 101A The Village, 7 Shields Street, Cairns QLD 4870  ·  ABN 84 136 380 642", margin, 112);
  doc.text("07 4031 7655  ·  info@scubapix.com  ·  scubapix.com", margin, 128);

  const detailY = 164;
  doc.fillColor(MUTED).font(FONT_BOLD).fontSize(8).text("PREPARED FOR", margin, detailY);
  doc.fillColor(TEXT).font(FONT_REGULAR).fontSize(12).text(customerName(customer), margin, detailY + 18);
  doc.fillColor("#505C67").fontSize(9);
  const customerLines = [
    customer?.email,
    customer?.phone,
    [customer?.city, customer?.region].filter(Boolean).join(" "),
  ].filter(Boolean) as string[];
  let customerY = detailY + 36;
  customerLines.forEach((line) => {
    doc.text(line, margin, customerY);
    customerY += 14;
  });

  doc.fillColor(MUTED).font(FONT_BOLD).fontSize(8).text("SYSTEM", margin, detailY, {
    align: "right",
  });
  doc.fillColor(TEXT).font(FONT_REGULAR).fontSize(12).text(quote.name || "Untitled system", margin, detailY + 18, {
    align: "right",
  });
  doc.fillColor("#505C67").fontSize(9).text(`Valid until ${formatDate(valid)}`, margin, detailY + 36, {
    align: "right",
  });

  let y = Math.max(customerY + 16, 230);
  y = drawItemsTable(doc, quote, y, margin, right);
  y += 24;
  drawTotals(doc, quote, t, y, right);

  const footerY = Math.max(doc.y + 28, 735);
  doc.moveTo(margin, footerY).lineTo(right, footerY).strokeColor(LINE).stroke();
  doc.fillColor("#78848F").font(FONT_REGULAR).fontSize(8);
  doc.text("This quote is valid for 30 days. Prices in AUD. Errors & omissions excepted. Stock subject to availability.", margin, footerY + 16);
  doc.text("Thank you for choosing Scubapix — Australia's Nauticam specialist.", margin, footerY + 30);
}

function drawItemsTable(
  doc: PDFKit.PDFDocument,
  quote: Quote,
  startY: number,
  left: number,
  right: number,
) {
  const columns = {
    part: left,
    sku: left + 265,
    qty: left + 350,
    unit: left + 390,
    line: right - 78,
  };
  const rowH = 28;

  doc.rect(left, startY, right - left, rowH).fill(TEAL);
  doc.fillColor("#FFFFFF").font(FONT_BOLD).fontSize(8);
  doc.text("Part", columns.part + 8, startY + 10);
  doc.text("SKU", columns.sku, startY + 10);
  doc.text("Qty", columns.qty, startY + 10, { width: 28, align: "right" });
  doc.text("Unit (ex GST)", columns.unit, startY + 10, { width: 78, align: "right" });
  doc.text("Line (ex GST)", columns.line, startY + 10, { width: 78, align: "right" });

  let y = startY + rowH;
  doc.font(FONT_REGULAR).fontSize(9);
  quote.items.forEach((item) => {
    if (y > 690) {
      doc.addPage();
      y = 45;
    }
    doc.rect(left, y, right - left, rowH).fill("#FFFFFF").strokeColor(LINE).stroke();
    doc.fillColor(TEXT).font(FONT_REGULAR).fontSize(9).text(item.name, columns.part + 8, y + 8, {
      width: 245,
      ellipsis: true,
    });
    doc.fillColor(MUTED).font(FONT_MONO).fontSize(8).text(item.sku || `#${item.productId}`, columns.sku, y + 9, {
      width: 80,
    });
    doc.fillColor(TEXT).font(FONT_MONO).fontSize(9);
    doc.text(String(item.qty), columns.qty, y + 9, { width: 28, align: "right" });
    doc.text(money(item.priceCents), columns.unit, y + 9, { width: 78, align: "right" });
    doc.text(money(item.qty * item.priceCents), columns.line, y + 9, { width: 78, align: "right" });
    y += rowH;
  });

  return y;
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  quote: Quote,
  t: ReturnType<typeof totals>,
  startY: number,
  right: number,
) {
  const labelX = right - 205;
  const valueX = right - 85;
  let y = startY;

  const row = (label: string, value: string, bold = false, color = TEXT) => {
    doc.fillColor(bold ? TEXT : MUTED).font(bold ? FONT_BOLD : FONT_REGULAR).fontSize(bold ? 11 : 9.5);
    doc.text(label, labelX, y, { width: 120 });
    doc.fillColor(color).font(bold ? FONT_MONO_BOLD : FONT_MONO).text(value, valueX, y, {
      width: 85,
      align: "right",
    });
    y += bold ? 19 : 15;
  };

  row("Subtotal (ex GST)", money(t.sub));
  row("GST 10%", money(t.gst));
  if (t.trade > 0) {
    row("Total (inc GST)", money(t.total));
    quote.tradeins.forEach((tradein) => row(`Less: ${truncate(tradein.label, 34)}`, `-${money(tradein.amountCents)}`, false, RED));
    doc.moveTo(labelX, y - 5).lineTo(right, y - 5).strokeColor(LINE).stroke();
    row("Amount payable", money(t.payable), true);
  } else {
    doc.moveTo(labelX, y - 5).lineTo(right, y - 5).strokeColor(LINE).stroke();
    row("Total (inc GST)", money(t.total), true);
  }
}

function registerQuoteFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont(FONT_REGULAR, FONT_PATHS.regular);
  doc.registerFont(FONT_BOLD, FONT_PATHS.bold);
  doc.registerFont(FONT_MONO, FONT_PATHS.mono);
  doc.registerFont(FONT_MONO_BOLD, FONT_PATHS.monoBold);
}

function fontPath(...segments: string[]) {
  return path.join(process.cwd(), "node_modules", ...segments);
}

function customerName(customer: Customer | null) {
  return customer && (customer.firstName || customer.lastName)
    ? `${customer.firstName} ${customer.lastName}`.trim()
    : "—";
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}
