import type { Customer } from "@/types";
import { getAppMode } from "@/lib/app-mode";
import {
  BigCommerceError,
  createBigCommerceCustomer,
  customerToBigCommerce,
  findBigCommerceCustomerByEmail,
} from "@/lib/bigcommerce";
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
    const customer = normaliseCustomerForSave(payload.customer);

    if (mode === "demo") {
      try {
        const saved = await saveDemoCustomer(customer);
        return Response.json({ customer: saved, mode });
      } catch {
        // Keep demo usable when no local database is configured.
      }
      return Response.json({
        customer: {
          ...customer,
          id: customer.id ?? `demo-${Date.now()}`,
        },
        mode,
      });
    }

    const existing = await findBigCommerceCustomerByEmail(customer.email);
    if (existing) {
      console.info("BigCommerce customer linked by email", {
        mode,
        customer_id: existing.id,
        email: existing.email,
        wroteToBigCommerce: false,
      });
      return Response.json({ customer: existing, mode, linkedExisting: true });
    }

    if (mode === "dry_run") {
      console.info("BigCommerce dry-run customer create", {
        mode,
        payload: customerToBigCommerce(customer),
        wroteToBigCommerce: false,
      });
      return Response.json({
        customer: {
          ...customer,
          id: `dry-run-${Date.now()}`,
        },
        mode,
        dryRun: true,
      });
    }

    const created = await createBigCommerceCustomer(customer);
    return Response.json({ customer: created, mode, created: true });
  } catch (error) {
    if (error instanceof BigCommerceError && error.status === 422) {
      console.error("BigCommerce customer 422 response", {
        status: error.status,
        payload: error.payload,
      });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save customer." },
      { status: 400 },
    );
  }
}

function normaliseCustomerForSave(customer: Customer): Customer {
  const firstName = customer.firstName.trim();
  const email = customer.email.trim();
  if (!firstName || !email) throw new Error("First name and email are required.");

  return {
    ...customer,
    firstName,
    lastName: customer.lastName.trim() || "Customer",
    email,
    phone: customer.phone.trim(),
    street1: customer.street1.trim(),
    city: customer.city.trim(),
    region: customer.region.trim(),
    postcode: customer.postcode.trim(),
    country: customer.country.trim() || "Australia",
    countryIso2: customer.countryIso2.trim() || "AU",
  };
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
