import { emailQuote } from "@/lib/quote-email";
import { loadQuote } from "@/lib/quote-persistence";
import { quotePdfFilename, renderQuotePdf } from "@/lib/quote-pdf";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    console.info("Quote email request received", { quoteId: id });
    const result = await loadQuote(id);
    if (!result) return Response.json({ error: "Quote not found." }, { status: 404 });

    const pdf = await renderQuotePdf(result);
    const filename = quotePdfFilename(result.quote, result.customer);
    const email = await emailQuote({ ...result, pdf, filename });

    return Response.json(email);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not email quote." },
      { status: 400 },
    );
  }
}
