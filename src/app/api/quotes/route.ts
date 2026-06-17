import { saveQuote, type SaveQuotePayload } from "@/lib/quote-persistence";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SaveQuotePayload;
    const result = await saveQuote(payload, "create");
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save quote." },
      { status: 400 },
    );
  }
}
