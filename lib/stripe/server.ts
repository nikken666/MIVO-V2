type StripeRequestOptions = {
  method?: "GET" | "POST";
  body?: URLSearchParams;
};

export function getStripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe is not configured yet.");
  }
  return key;
}

export async function stripeRequest<T>(
  path: string,
  options: StripeRequestOptions = {}
): Promise<T> {
  const response = await fetch("https://api.stripe.com/v1" + path, {
    method: options.method || "GET",
    headers: {
      Authorization: "Bearer " + getStripeSecretKey(),
      ...(options.body
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body: options.body,
    cache: "no-store",
  });

  const data = (await response.json()) as T & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message || "Stripe request failed.");
  }

  return data;
}

export function verifyStripeWebhookSignature(
  payload: string,
  signatureHeader: string
) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Missing STRIPE_WEBHOOK_SECRET.");

  const entries = signatureHeader.split(",").map((part) => part.trim());
  const timestamp = entries
    .find((part) => part.startsWith("t="))
    ?.slice(2);
  const signatures = entries
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const crypto = require("node:crypto") as typeof import("node:crypto");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(timestamp + "." + payload, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "utf8");

  return signatures.some((signature) => {
    const candidate = Buffer.from(signature, "utf8");
    return (
      candidate.length === expectedBuffer.length &&
      crypto.timingSafeEqual(candidate, expectedBuffer)
    );
  });
}
