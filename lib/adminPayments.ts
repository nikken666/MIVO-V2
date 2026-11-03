// Admin/seller (browser): charge a held card payment before marking an order shipped.
// Pass the shop parcel being shipped: the card is charged only when the last
// parcel of the order ships (until then the hold stays in place).
export async function chargeBeforeShipping(orderNumber: string, parcelId?: string | null) {
  const response = await fetch("/api/admin/payments/capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderNumber, parcelId: parcelId || null }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error("Payment not charged, order not shipped: " + (data.error || "card capture failed."));
  }
}
