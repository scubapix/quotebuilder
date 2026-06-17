import type { Customer } from "@/types";
import { getAppMode } from "@/lib/app-mode";
import { customerToBigCommerce, saveBigCommerceCustomer } from "@/lib/bigcommerce";
import { toCustomer } from "@/lib/db-mappers";
import { prisma } from "@/lib/prisma";

type CustomerPayload = {
  customer?: Customer;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CustomerPayload;
    if (!payload.customer) {
      return Response.json({ error: "Customer is required." }, { status: 400 });
    }

    const mode = getAppMode();

    if (mode === "demo") {
      try {
        const customer = await saveDemoCustomer(payload.customer);
        return Response.json({ customer, mode });
      } catch {
        // Keep demo usable when no local database is configured.
      }
      return Response.json({
        customer: {
          ...payload.customer,
          id: payload.customer.id ?? `demo-${Date.now()}`,
        },
        mode,
      });
    }

    if (mode === "dry_run") {
      console.info("BigCommerce dry-run customer save", {
        mode,
        payload: customerToBigCommerce(payload.customer),
      });
      return Response.json({
        customer: {
          ...payload.customer,
          id: typeof payload.customer.id === "number" ? payload.customer.id : `dry-run-${Date.now()}`,
        },
        mode,
        dryRun: true,
      });
    }

    const customer = await saveBigCommerceCustomer(payload.customer);
    return Response.json({ customer, mode });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save customer." },
      { status: 400 },
    );
  }
}

async function saveDemoCustomer(customer: Customer) {
  const data = {
    firstName: customer.firstName,
    lastName: customer.lastName || "",
    email: customer.email,
    phone: customer.phone || "",
    street1: customer.street1 || "",
    city: customer.city || "",
    region: customer.region || "",
    postcode: customer.postcode || "",
    country: customer.country || "Australia",
    countryIso2: customer.countryIso2 || "AU",
  };

  if (typeof customer.id === "string" && customer.id && !customer.id.startsWith("demo-")) {
    const existing = await prisma.customer.findUnique({ where: { id: customer.id } });
    if (existing) {
      return toCustomer(await prisma.customer.update({ where: { id: customer.id }, data }));
    }
  }

  const existing = data.email ? await prisma.customer.findFirst({ where: { email: data.email } }) : null;
  if (existing) {
    return toCustomer(await prisma.customer.update({ where: { id: existing.id }, data }));
  }

  return toCustomer(await prisma.customer.create({ data }));
}
