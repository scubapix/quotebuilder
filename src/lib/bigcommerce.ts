import type { CatalogItem, Customer } from "@/types";

export interface BigCommerceCartLineItem {
  productId: number;
  variantId: number | null;
  quantity: number;
}

type BigCommerceVariant = {
  id: number;
  sku?: string;
  price?: number | string | null;
  calculated_price?: number | string | null;
  option_values?: Array<{ label?: string; option_display_name?: string }>;
};

type BigCommerceProduct = {
  id: number;
  name: string;
  sku?: string;
  price?: number | string | null;
  calculated_price?: number | string | null;
  categories?: number[];
  variants?: BigCommerceVariant[];
};

type BigCommerceCategory = {
  id: number;
  name: string;
};

type BigCommerceAddress = {
  address1?: string;
  street_1?: string;
  city?: string;
  state_or_province?: string;
  postal_code?: string;
  country?: string;
  country_code?: string;
};

type BigCommerceCustomer = {
  id?: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  addresses?: BigCommerceAddress[];
};

type BigCommerceListResponse<T> = {
  data?: T[];
  meta?: {
    pagination?: {
      total_pages?: number;
      total?: number;
      current_page?: number;
    };
  };
};

type BigCommerceErrorPayload = {
  title?: string;
  detail?: string;
  message?: string;
  errors?: unknown;
};

type BigCommerceCartResponse = {
  data?: {
    id?: string;
  };
};

type BigCommerceRedirectUrlsResponse = {
  data?: {
    checkout_url?: string;
  };
};

export class BigCommerceError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly payload?: unknown,
  ) {
    super(message);
  }
}

function getConfig() {
  const storeHash = process.env.BIGCOMMERCE_STORE_HASH;
  const token = process.env.BIGCOMMERCE_ACCESS_TOKEN;
  if (!storeHash || !token) throw new BigCommerceError("BigCommerce credentials are not configured.");
  return {
    baseUrl: `https://api.bigcommerce.com/stores/${storeHash}/`,
    token,
  };
}

const MAX_RATE_LIMIT_RETRIES = 3;

async function requestBigCommerce<T>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
  const { baseUrl, token } = getConfig();
  const response = await fetch(new URL(path.replace(/^\//, ""), baseUrl), {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Auth-Token": token,
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
    await sleep(retryDelayMs(response));
    return requestBigCommerce<T>(path, init, attempt + 1);
  }

  if (!response.ok) {
    const payload = await readBigCommerceError(response);
    const message = bigCommerceErrorMessage(response.status, payload);
    throw new BigCommerceError(message, response.status, payload);
  }

  return (await response.json()) as T;
}

export async function createBigCommerceCheckout(input: {
  lineItems: BigCommerceCartLineItem[];
  customerId: number | null;
}) {
  const cartLineItems = input.lineItems.map((item) => ({
    product_id: item.productId,
    ...(item.variantId !== null ? { variant_id: item.variantId } : {}),
    quantity: item.quantity,
  }));
  const cart = await requestBigCommerce<BigCommerceCartResponse>("/v3/carts", {
    method: "POST",
    body: JSON.stringify({
      line_items: cartLineItems,
      ...(input.customerId ? { customer_id: input.customerId } : {}),
    }),
  });

  const cartId = cart.data?.id;
  if (!cartId) throw new BigCommerceError("BigCommerce cart creation returned no cart id.");

  const redirectUrls = await requestBigCommerce<BigCommerceRedirectUrlsResponse>(
    `/v3/carts/${encodeURIComponent(cartId)}/redirect_urls`,
    { method: "POST" },
  );
  const checkoutUrl = redirectUrls.data?.checkout_url;
  if (!checkoutUrl) throw new BigCommerceError("BigCommerce cart creation returned no checkout URL.");

  return { cartId, checkoutUrl };
}

export async function fetchAllBigCommerceProducts(): Promise<{
  items: CatalogItem[];
  productCount: number;
  pages: number;
}> {
  const categoryMap = await fetchCategoryMap();
  const firstPage = await fetchProductPage(1);
  const totalPages = Math.max(1, firstPage.meta?.pagination?.total_pages ?? 1);
  const products = [...(firstPage.data ?? [])];

  for (let page = 2; page <= totalPages; page += 1) {
    const json = await fetchProductPage(page);
    products.push(...(json.data ?? []));
  }

  return {
    items: products.flatMap((product) => productToCatalogItems(product, categoryMap)),
    productCount: firstPage.meta?.pagination?.total ?? products.length,
    pages: totalPages,
  };
}

export async function searchBigCommerceProducts(query: string): Promise<CatalogItem[]> {
  const params = new URLSearchParams({
    include: "variants",
    limit: "50",
    keyword: query,
  });
  const json = await requestBigCommerce<BigCommerceListResponse<BigCommerceProduct>>(
    `/v3/catalog/products?${params.toString()}`,
  );

  return (json.data ?? []).flatMap((product) => productToCatalogItems(product)).slice(0, 8);
}

function fetchProductPage(page: number) {
  const params = new URLSearchParams({
    include: "variants",
    limit: "250",
    page: String(page),
  });
  return requestBigCommerce<BigCommerceListResponse<BigCommerceProduct>>(
    `/v3/catalog/products?${params.toString()}`,
  );
}

async function fetchCategoryMap() {
  const firstPage = await fetchCategoryPage(1);
  const totalPages = Math.max(1, firstPage.meta?.pagination?.total_pages ?? 1);
  const categories = [...(firstPage.data ?? [])];

  for (let page = 2; page <= totalPages; page += 1) {
    const json = await fetchCategoryPage(page);
    categories.push(...(json.data ?? []));
  }

  return new Map(categories.map((category) => [category.id, category.name]));
}

function fetchCategoryPage(page: number) {
  const params = new URLSearchParams({
    limit: "250",
    page: String(page),
  });
  return requestBigCommerce<BigCommerceListResponse<BigCommerceCategory>>(
    `/v3/catalog/categories?${params.toString()}`,
  );
}

export async function searchBigCommerceCustomers(query: string): Promise<Customer[]> {
  const params = new URLSearchParams({
    include: "addresses",
    limit: "10",
  });
  params.set(query.includes("@") ? "email:in" : "name:like", query);

  const json = await requestBigCommerce<BigCommerceListResponse<BigCommerceCustomer>>(
    `/v3/customers?${params.toString()}`,
  );

  return (json.data ?? []).map(customerFromBigCommerce).slice(0, 6);
}

export async function findBigCommerceCustomerByEmail(email: string): Promise<Customer | null> {
  const matches = await searchBigCommerceCustomers(email);
  const normalised = email.trim().toLowerCase();
  return matches.find((customer) => customer.email.trim().toLowerCase() === normalised) ?? null;
}

export async function createBigCommerceCustomer(customer: Customer): Promise<Customer> {
  const payload = customerToBigCommerce(customer);
  const json = await requestBigCommerce<BigCommerceListResponse<BigCommerceCustomer>>("/v3/customers", {
    method: "POST",
    body: JSON.stringify([payload]),
  });

  const saved = json.data?.[0];
  if (!saved) throw new BigCommerceError("BigCommerce customer create returned no customer.");
  return customerFromBigCommerce(saved);
}

export function customerToBigCommerce(customer: Customer) {
  const base = {
    first_name: customer.firstName.trim(),
    last_name: customer.lastName.trim() || "Customer",
    email: customer.email.trim(),
    phone: customer.phone.trim() || undefined,
  };
  const address = customerAddressToBigCommerce(customer);
  if (!address) return base;

  return {
    ...base,
    addresses: [address],
  };
}

function customerAddressToBigCommerce(customer: Customer) {
  const address1 = customer.street1.trim();
  if (!address1) return null;

  return {
    first_name: customer.firstName.trim(),
    last_name: customer.lastName.trim() || "Customer",
    address1,
    city: customer.city.trim() || "Unknown",
    state_or_province: customer.region.trim() || undefined,
    postal_code: customer.postcode.trim() || undefined,
    country_code: customer.countryIso2.trim() || "AU",
  };
}

function productToCatalogItems(
  product: BigCommerceProduct,
  categoryMap?: Map<number, string>,
): CatalogItem[] {
  const variants = product.variants ?? [];
  if (!variants.length) {
    return [
      catalogItemFromProduct(
        product,
        {
          variantId: null,
          sku: product.sku || `#${product.id}`,
          price: product.price ?? product.calculated_price,
          optionLabel: "",
        },
        categoryMap,
      ),
    ];
  }

  return variants.map((variant) =>
    catalogItemFromProduct(
      product,
      {
        variantId: variant.id,
        sku: variant.sku || product.sku || `#${product.id}-${variant.id}`,
        price: variant.price ?? product.price ?? variant.calculated_price ?? product.calculated_price,
        optionLabel: optionLabel(variant),
      },
      categoryMap,
    ),
  );
}

function catalogItemFromProduct(
  product: BigCommerceProduct,
  variant: { variantId: number | null; sku: string; price: number | string | null | undefined; optionLabel: string },
  categoryMap?: Map<number, string>,
): CatalogItem {
  const cat = categoryName(product, categoryMap);
  const name = variant.optionLabel ? `${product.name} — ${variant.optionLabel}` : product.name;
  return {
    productId: product.id,
    variantId: variant.variantId,
    sku: variant.sku,
    name,
    // BC price tax-inclusivity depends on store tax settings; verify live store pricing because this app assumes ex-GST.
    priceCents: dollarsToCents(variant.price),
    cat,
    category: cat,
  };
}

function categoryName(product: BigCommerceProduct, categoryMap?: Map<number, string>) {
  const categoryIds = product.categories ?? [];
  if (!categoryMap) {
    return categoryIds.length ? `Category ${categoryIds[0]}` : "";
  }
  if (!categoryIds.length) return "Uncategorised";

  // BigCommerce returns assigned category ids as an array; use the last assigned id as the most specific display category.
  const categoryId = categoryIds[categoryIds.length - 1];
  return categoryMap.get(categoryId) ?? "Uncategorised";
}

function optionLabel(variant: BigCommerceVariant) {
  return (variant.option_values ?? [])
    .map((value) => value.label)
    .filter(Boolean)
    .join(" / ");
}

function customerFromBigCommerce(customer: BigCommerceCustomer): Customer {
  const address = customer.addresses?.[0];
  return {
    id: customer.id ?? null,
    firstName: customer.first_name ?? "",
    lastName: customer.last_name ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    street1: address?.street_1 ?? address?.address1 ?? "",
    city: address?.city ?? "",
    region: address?.state_or_province ?? "",
    postcode: address?.postal_code ?? "",
    country: address?.country ?? "Australia",
    countryIso2: address?.country_code ?? "AU",
  };
}

function dollarsToCents(value: number | string | null | undefined) {
  return Math.round((Number(value) || 0) * 100);
}

async function readBigCommerceError(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as BigCommerceErrorPayload;
  } catch {
    return { message: text };
  }
}

function bigCommerceErrorMessage(status: number, payload: unknown) {
  const text = JSON.stringify(payload ?? "").toLowerCase();
  if (
    [400, 404, 409, 422].includes(status) &&
    /(stock|inventory|unavailable|not available|not purchasable|variant|product)/i.test(text)
  ) {
    return "One or more quoted products are unavailable or out of stock in BigCommerce.";
  }

  return `BigCommerce request failed with status ${status}`;
}

function retryDelayMs(response: Response) {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;

  const resetMs = Number(response.headers.get("x-rate-limit-time-reset-ms"));
  if (Number.isFinite(resetMs) && resetMs > 0) return resetMs;

  return 1000;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
