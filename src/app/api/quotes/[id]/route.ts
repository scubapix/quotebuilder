import { loadQuote, saveQuote, type SaveQuotePayload } from "@/lib/quote-persistence";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await loadQuote(id);
  if (!result) return Response.json({ error: "Quote not found." }, { status: 404 });
  return Response.json(result);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as SaveQuotePayload;
    const result = await saveQuote({ ...payload, quote: { ...payload.quote, id } }, "update");
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save quote.";
    return Response.json({ error: message }, { status: message === "Quote not found." ? 404 : 400 });
  }
}
