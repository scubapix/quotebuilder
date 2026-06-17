import type { CatalogItem, Customer } from "@/types";

export function toCatalogItem(item: {
  productId: number;
  variantId: number | null;
  sku: string;
  name: string;
  priceCents: number;
  category: string;
}): CatalogItem {
  return {
    productId: item.productId,
    variantId: item.variantId,
    sku: item.sku,
    name: item.name,
    priceCents: item.priceCents,
    cat: item.category,
    category: item.category,
  };
}

export function toCustomer(customer: {
  id: string;
  bigCommerceId: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street1: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  countryIso2: string;
}): Customer {
  return {
    id: customer.bigCommerceId ?? customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    street1: customer.street1,
    city: customer.city,
    region: customer.region,
    postcode: customer.postcode,
    country: customer.country,
    countryIso2: customer.countryIso2,
  };
}
