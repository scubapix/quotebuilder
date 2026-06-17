import { prisma } from "@/lib/prisma";
import { toCustomer } from "@/lib/db-mappers";
import { canReadBigCommerce } from "@/lib/app-mode";
import { searchBigCommerceCustomers } from "@/lib/bigcommerce";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 2) return Response.json({ items: [] });

  if (canReadBigCommerce()) {
    try {
      const items = await searchBigCommerceCustomers(q);
      return Response.json({ items });
    } catch {
      // Match the prototype: live-read failures fall back to seeded demo customers.
    }
  }

  const rows = await prisma.customer.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const items = rows
    .filter((customer) => {
      const query = q.toLowerCase();
      const haystack = `${customer.firstName} ${customer.lastName} ${customer.email} ${customer.city} ${customer.region}`.toLowerCase();
      return haystack.includes(query);
    })
    .slice(0, 6)
    .map(toCustomer);

  return Response.json({ items });
}
