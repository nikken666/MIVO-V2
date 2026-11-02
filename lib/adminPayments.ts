// Admin (browser): charge a held card payment before marking an order shipped.
export async function chargeBeforeShipping(orderNumber: string) {
  const response = await fetch("/api/admin/payments/capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderNumber }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error("Payment not charged, order not shipped: " + (data.error || "card capture failed."));
  }
}
