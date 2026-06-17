import { listTemplates, saveQuoteAsTemplate } from "@/lib/quote-persistence";
import type { Quote } from "@/types";

type SaveTemplatePayload = {
  name?: string;
  quote?: Quote;
};

export async function GET() {
  const templates = await listTemplates();
  return Response.json({ templates });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SaveTemplatePayload;
    if (!payload.quote) {
      return Response.json({ error: "Quote is required." }, { status: 400 });
    }

    const result = await saveQuoteAsTemplate({ name: payload.name ?? "", quote: payload.quote });
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save template." },
      { status: 400 },
    );
  }
}
