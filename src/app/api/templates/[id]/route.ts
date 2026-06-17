import { renameTemplate } from "@/lib/quote-persistence";

type RenameTemplatePayload = {
  name?: string;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const payload = (await request.json()) as RenameTemplatePayload;
    const result = await renameTemplate(id, payload.name ?? "");
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not rename template.";
    return Response.json({ error: message }, { status: message === "Template not found." ? 404 : 400 });
  }
}
