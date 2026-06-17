import { getAppMode } from "@/lib/app-mode";
import { BigCommerceError, createBigCommerceCheckout } from "@/lib/bigcommerce";
import { prisma } from "@/lib/prisma";
import { loadQuote } from "@/lib/quote-persistence";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await loadQuote(id);
  if (!result) {
    return Response.json({ error: "Quote not found." }, { status: 404 });
  }

  const lineItems = result.quote.items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.qty,
  }));
  if (!lineItems.length) {
    return Response.json({ error: "This quote has no items to add to cart." }, { status: 400 });
  }

  const customerId = typeof result.customer?.id === "number" ? result.customer.id : null;
  const mode = getAppMode();

  if (mode !== "live") {
    const checkoutUrl = dryRunCheckoutUrl(id);
    console.info("Quote checkout dry-run", {
      mode,
      quoteId: id,
      customer_id: customerId,
      line_items: lineItems.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
      })),
      checkout_url: checkoutUrl,
    });
    return Response.json({ checkout_url: checkoutUrl, dryRun: true });
  }

  try {
    const checkout = await createBigCommerceCheckout({ lineItems, customerId });
    await prisma.quote.update({
      where: { id },
      data: { checkoutUrl: checkout.checkoutUrl },
    });
    return Response.json({
      checkout_url: checkout.checkoutUrl,
      cart_id: checkout.cartId,
      customer_id: customerId,
      dryRun: false,
    });
  } catch (error) {
    if (error instanceof BigCommerceError) {
      return Response.json({ error: error.message }, { status: bigCommerceStatus(error) });
    }
    return Response.json({ error: "Could not create the BigCommerce cart." }, { status: 502 });
  }
}

function dryRunCheckoutUrl(quoteId: string) {
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${appUrl}/quote/${encodeURIComponent(quoteId)}/cart?dry_run_checkout=1`;
}

function bigCommerceStatus(error: BigCommerceError) {
  if (error.message.includes("unavailable") || error.message.includes("out of stock")) return 409;
  return error.status && error.status >= 400 && error.status < 500 ? error.status : 502;
}
