import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendMail, siteUrl } from "./mailer";
import {
  campaignEmail,
  cancelledEmail,
  lang,
  orderPaidEmail,
  parcelEmail,
  refundedEmail,
  type Item,
  type OrderInfo,
} from "./templates";

type Admin = ReturnType<typeof createAdminClient>;
type QueueRow = {
  id: string;
  kind: "order_paid" | "order_cancelled" | "order_refunded" | "parcel_shipped" | "parcel_delivered" | "campaign";
  order_id: string | null;
  seller_order_id: string | null;
  campaign_id: string | null;
  user_id: string | null;
  attempts: number;
};

// Gmail allows about 500 emails a day. Promotions pause at this number; order emails always go.
const DAILY_LIMIT = Number(process.env.EMAIL_DAILY_LIMIT || 450);

function unsubscribeSecret() {
  return process.env.EMAIL_QUEUE_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
}

export function unsubscribeToken(userId: string) {
  return createHmac("sha256", unsubscribeSecret()).update("unsubscribe:" + userId).digest("base64url");
}

export function checkUnsubscribeToken(userId: string, token: string) {
  const expected = Buffer.from(unsubscribeToken(userId));
  const given = Buffer.from(String(token || ""));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

async function customer(admin: Admin, userId: string) {
  const { data } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  const profile = (data || {}) as Record<string, unknown>;
  let email = String(profile.email || "").trim();
  if (!email) {
    const { data: auth } = await admin.auth.admin.getUserById(userId).catch(() => ({ data: null }));
    email = String(auth?.user?.email || "").trim();
  }
  return {
    email,
    name: String(profile.full_name || "").trim() || email.split("@")[0] || "",
    l: lang(profile.preferred_language),
    optIn: Boolean(profile.marketing_opt_in),
  };
}

function itemRows(rows: Array<Record<string, unknown>>): Item[] {
  return rows.map((row) => ({
    name: String(row.product_name || ""),
    variant: (row.variant_name as string) || null,
    qty: Number(row.quantity || 1),
    total: Number(row.line_subtotal ?? Number(row.unit_price || 0) * Number(row.quantity || 1)),
  }));
}

async function orderInfo(admin: Admin, orderId: string, name: string): Promise<OrderInfo | null> {
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return null;
  const o = order as Record<string, unknown>;
  const { data: items } = await admin.from("order_items").select("*").eq("order_id", orderId);
  return {
    orderNumber: String(o.order_number || ""),
    name,
    items: itemRows((items || []) as Array<Record<string, unknown>>),
    subtotal: Number(o.subtotal || 0),
    shipping: Number(o.shipping_amount || 0),
    discount: Number(o.discount_amount || 0),
    total: Number(o.payment_paid_amount || o.total_amount || 0),
    address: (o.shipping_address as Record<string, unknown>) || null,
    reason: (o.cancellation_reason as string) || null,
    refund: o.cancellation_refund_amount != null ? Number(o.cancellation_refund_amount) : null,
  };
}

async function build(admin: Admin, row: QueueRow) {
  if (!row.user_id) return null;
  const who = await customer(admin, row.user_id);
  if (!who.email) return null;
  const site = siteUrl();

  if (row.kind === "campaign") {
    if (!who.optIn || !row.campaign_id) return null; // unsubscribed since it was queued
    const { data } = await admin.from("email_campaigns").select("*").eq("id", row.campaign_id).maybeSingle();
    if (!data) return null;
    const unsubscribeUrl = site + "/api/email/unsubscribe?u=" + row.user_id + "&t=" + unsubscribeToken(row.user_id);
    return { to: who.email, ...campaignEmail(site, who.l, data, who.name, unsubscribeUrl) };
  }

  if (!row.order_id) return null;
  if (row.kind === "parcel_shipped" || row.kind === "parcel_delivered") {
    if (!row.seller_order_id) return null;
    const [{ data: parcel }, { data: shipment }, { data: items }, { data: order }] = await Promise.all([
      admin.from("seller_orders").select("*").eq("id", row.seller_order_id).maybeSingle(),
      admin.from("shipments").select("*").eq("seller_order_id", row.seller_order_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("order_items").select("*").eq("seller_order_id", row.seller_order_id),
      admin.from("orders").select("order_number").eq("id", row.order_id).maybeSingle(),
    ]);
    if (!parcel) return null;
    const p = parcel as Record<string, unknown>;
    const s = (shipment || {}) as Record<string, unknown>;
    let shop = "MIVO";
    if (p.seller_id) {
      const { data: seller } = await admin.from("sellers").select("shop_name").eq("id", p.seller_id as string).maybeSingle();
      shop = (seller?.shop_name as string) || shop;
    }
    return {
      to: who.email,
      ...parcelEmail(site, who.l, row.kind === "parcel_shipped" ? "shipped" : "delivered", {
        orderNumber: String(order?.order_number || p.order_number || ""),
        name: who.name,
        shop,
        courier: (s.courier_name as string) || (p.courier_name as string) || (p.buyer_courier_name as string) || null,
        tracking: (s.tracking_number as string) || null,
        trackingUrl: (s.tracking_url as string) || null,
        items: itemRows((items || []) as Array<Record<string, unknown>>),
      }),
    };
  }

  const info = await orderInfo(admin, row.order_id, who.name);
  if (!info) return null;
  const mail =
    row.kind === "order_paid"
      ? orderPaidEmail(site, who.l, info)
      : row.kind === "order_cancelled"
        ? cancelledEmail(site, who.l, info)
        : refundedEmail(site, who.l, info);
  return { to: who.email, ...mail };
}

/** Send what is waiting in email_queue. Safe to call from many places at once. */
export async function processEmailQueue(options: { limit?: number; deadlineMs?: number } = {}) {
  const result = { sent: 0, failed: 0, skipped: 0, configured: emailConfigured() };
  if (!result.configured) return result;
  const admin = createAdminClient();
  const stopAt = Date.now() + (options.deadlineMs ?? 40_000);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("email_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "sent")
    .gte("sent_at", since);
  const campaignsAllowed = Math.max(0, DAILY_LIMIT - (count || 0));

  const { data, error } = await admin.rpc("mivo_email_claim", {
    p_limit: Math.min(options.limit ?? 25, 100),
    p_campaigns: campaignsAllowed > 0,
  });
  if (error) throw error;

  let campaignBudget = campaignsAllowed;
  for (const row of (data || []) as QueueRow[]) {
    if (Date.now() > stopAt || (row.kind === "campaign" && campaignBudget <= 0)) {
      await admin.from("email_queue").update({ status: "pending", attempts: Math.max(0, row.attempts - 1) }).eq("id", row.id);
      continue;
    }
    try {
      const mail = await build(admin, row);
      if (!mail) {
        await admin.from("email_queue").update({ status: "skipped", last_error: "No email address or nothing to send" }).eq("id", row.id);
        result.skipped++;
        continue;
      }
      await sendMail(mail);
      await admin.from("email_queue").update({ status: "sent", recipient: mail.to, sent_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
      if (row.kind === "campaign") campaignBudget--;
      result.sent++;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      await admin.from("email_queue").update({ status: "failed", last_error: message.slice(0, 500) }).eq("id", row.id);
      result.failed++;
    }
  }
  return result;
}

/** Never throws: used right after a payment so the receipt goes out at once. */
export async function sendQueuedEmailsQuietly() {
  try {
    await processEmailQueue({ limit: 10, deadlineMs: 15_000 });
  } catch {
    // the daily check and the next order pick it up
  }
}
