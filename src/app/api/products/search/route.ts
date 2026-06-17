import { prisma } from "@/lib/prisma";
import { toCatalogItem } from "@/lib/db-mappers";
import { canReadBigCommerce } from "@/lib/app-mode";
import { searchBigCommerceProducts } from "@/lib/bigcommerce";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (!q) return Response.json({ items: [] });

  if (canReadBigCommerce()) {
    try {
      const items = await searchBigCommerceProducts(q);
      return Response.json({ items });
    } catch {
      // Match the prototype: live-read failures fall back to the seeded demo catalogue.
    }
  }

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = await prisma.catalogItem.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const items = rows
    .filter((item) => {
      const haystack = `${item.name} ${item.sku} ${item.category}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, 8)
    .map(toCatalogItem);

  return Response.json({ items });
}
