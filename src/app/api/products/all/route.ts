import { canReadBigCommerce } from "@/lib/app-mode";
import { fetchAllBigCommerceProducts } from "@/lib/bigcommerce";
import { toCatalogItem } from "@/lib/db-mappers";
import { DEMO_CATALOG } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";

export async function GET() {
  if (canReadBigCommerce()) {
    try {
      const result = await fetchAllBigCommerceProducts();
      return Response.json({ ...result, source: "bigcommerce" });
    } catch {
      // Match the prototype: live-read failures fall back to the seeded demo catalogue.
    }
  }

  try {
    const rows = await prisma.catalogItem.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    const productCount = new Set(rows.map((row) => row.productId)).size;

    return Response.json({
      items: rows.map(toCatalogItem),
      productCount,
      pages: 1,
      source: "seeded",
    });
  } catch {
    const items = DEMO_CATALOG.map((item) => ({ ...item, cat: item.category }));
    const productCount = new Set(items.map((item) => item.productId)).size;

    return Response.json({
      items,
      productCount,
      pages: 1,
      source: "seeded",
    });
  }
}
