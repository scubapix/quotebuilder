import type { CatalogItem, Customer } from "@/types";

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

export class BigCommerceError extends Error {}

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
    throw new BigCommerceError(`BigCommerce request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
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

export async function saveBigCommerceCustomer(customer: Customer): Promise<Customer> {
  const payload = customerToBigCommerce(customer);
  const id = typeof customer.id === "number" ? customer.id : null;
  const method = id ? "PUT" : "POST";
  const body = JSON.stringify([id ? { ...payload, id } : payload]);
  const json = await requestBigCommerce<BigCommerceListResponse<BigCommerceCustomer>>("/v3/customers", {
    method,
    body,
  });

  const saved = json.data?.[0];
  if (!saved) throw new BigCommerceError("BigCommerce customer save returned no customer.");
  return customerFromBigCommerce(saved);
}

export function customerToBigCommerce(customer: Customer) {
  return {
    first_name: customer.firstName,
    last_name: customer.lastName,
    email: customer.email,
    phone: customer.phone || undefined,
    addresses: [
      {
        first_name: customer.firstName,
        last_name: customer.lastName,
        street_1: customer.street1 || "",
        city: customer.city || "",
        state_or_province: customer.region || "",
        postal_code: customer.postcode || "",
        country_code: customer.countryIso2 || "AU",
      },
    ],
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
    street1: address?.street_1 ?? "",
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
