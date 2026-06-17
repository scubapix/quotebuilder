import { listDashboardQuotes } from "@/lib/quote-persistence";

export async function GET() {
  const quotes = await listDashboardQuotes();
  return Response.json({ quotes });
}
