import { loadQuote } from "@/lib/quote-persistence";
import { quotePdfFilename, renderQuotePdf } from "@/lib/quote-pdf";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await loadQuote(id);
  if (!result) return Response.json({ error: "Quote not found." }, { status: 404 });

  const pdf = await renderQuotePdf(result);
  const filename = quotePdfFilename(result.quote, result.customer);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.length),
    },
  });
}
