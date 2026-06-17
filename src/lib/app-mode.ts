import type { AppMode } from "@/types";

export function hasBigCommerceCredentials() {
  return Boolean(process.env.BIGCOMMERCE_STORE_HASH && process.env.BIGCOMMERCE_ACCESS_TOKEN);
}

export function getAppMode(): AppMode {
  const requested = process.env.SCUBAPIX_MODE?.toLowerCase();
  if (requested === "demo") return "demo";
  if (!hasBigCommerceCredentials()) return "demo";
  return requested === "live" ? "live" : "dry_run";
}

export function canReadBigCommerce() {
  return getAppMode() !== "demo" && hasBigCommerceCredentials();
}
