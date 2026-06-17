import { createQuoteFromTemplate } from "@/lib/quote-persistence";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await createQuoteFromTemplate(id);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not use template.";
    return Response.json({ error: message }, { status: message === "Template not found." ? 404 : 400 });
  }
}
