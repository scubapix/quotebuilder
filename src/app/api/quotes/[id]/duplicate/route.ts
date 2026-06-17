import { duplicateQuote } from "@/lib/quote-persistence";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await duplicateQuote(id);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not duplicate quote.";
    return Response.json({ error: message }, { status: message === "Quote not found." ? 404 : 400 });
  }
}
