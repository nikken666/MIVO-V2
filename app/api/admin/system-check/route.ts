import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeRequest } from "@/lib/stripe/server";
import { easyParcelStatus } from "@/lib/easyparcel/oauth";

export const dynamic = "force-dynamic";

type Check = { group: string; name: string; ok: boolean; warn?: boolean; detail: string; fix?: string };

const has = (name: string) => Boolean((process.env[name] || "").trim());

/** MIVO admin: is this deployment set up? Reports yes/no only, never secret values. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "MIVO admins only." }, { status: 403 });

  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);
  const vercelEnv = process.env.VERCEL_ENV || "local";

  // Website
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  add({
    group: "Website",
    name: "NEXT_PUBLIC_SITE_URL",
    ok: Boolean(site),
    warn: Boolean(site) && vercelEnv === "preview",
    detail: site
      ? site + (vercelEnv === "preview" ? " (on a preview, links in emails and EasyParcel go to this address)" : "")
      : "Missing",
    fix: "Set it to https://your-domain (no trailing slash).",
  });

  // Supabase
  let adminOk = false;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("orders").select("id", { head: true, count: "exact" }).limit(1);
    adminOk = !error;
    add({
      group: "Supabase",
      name: "Server key (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY)",
      ok: adminOk,
      detail: adminOk ? "Works" : "Rejected: " + error?.message,
      fix: "Copy the service_role / secret key from Supabase → Project Settings → API keys.",
    });
  } catch (caught) {
    add({
      group: "Supabase",
      name: "Server key (SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY)",
      ok: false,
      detail: caught instanceof Error ? caught.message : "Missing",
      fix: "Copy the service_role / secret key from Supabase → Project Settings → API keys.",
    });
  }

  if (adminOk) {
    const admin = createAdminClient();
    const sql: Array<[string, string, string]> = [
      ["seller_orders", "buyer_shipping_fee", "checkout-per-shop"],
      ["shipping_promotions", "id", "checkout-per-shop"],
      ["return_requests", "inspect_by", "returns-inspection"],
      ["warranty_claim_events", "id", "warranty-resolution"],
      ["product_reviews", "is_anonymous", "review-names"],
      ["shipments", "ep_shipment_number", "easyparcel"],
      ["easyparcel_connection", "id", "easyparcel"],
    ];
    const results = await Promise.all(
      sql.map(([table, column]) => admin.from(table).select(column, { head: true }).limit(1))
    );
    const missing = sql.filter((_, i) => results[i].error).map(([table, column, file]) => file + " (" + table + "." + column + ")");
    add({
      group: "Supabase",
      name: "Database updates (RUN-ALL.sql)",
      ok: missing.length === 0,
      detail: missing.length ? "Missing: " + [...new Set(missing)].join(", ") : "All tables and columns found",
      fix: "Run supabase/RUN-ALL.sql in Supabase → SQL Editor.",
    });
  }

  // Stripe
  const sk = process.env.STRIPE_SECRET_KEY || "";
  const mode = sk.startsWith("sk_live_") || sk.startsWith("rk_live_") ? "LIVE" : sk.startsWith("sk_test_") || sk.startsWith("rk_test_") ? "test" : "";
  if (!sk) {
    add({
      group: "Stripe",
      name: "STRIPE_SECRET_KEY",
      ok: false,
      detail: "Missing in this environment (" + vercelEnv + ")",
      fix: "Add it in Vercel → Settings → Environment Variables with " + vercelEnv + " ticked, then redeploy.",
    });
  } else {
    let reachable = "";
    try {
      await stripeRequest("/balance");
    } catch (caught) {
      reachable = caught instanceof Error ? caught.message : "Stripe rejected the key";
    }
    add({
      group: "Stripe",
      name: "STRIPE_SECRET_KEY",
      ok: !reachable,
      warn: mode === "LIVE" && vercelEnv !== "production",
      detail: (mode ? mode + " mode" : "Unknown key type") + (reachable ? " · " + reachable : " · Stripe accepted the key") +
        (mode === "LIVE" && vercelEnv !== "production" ? " · a LIVE key on a preview charges real cards" : ""),
      fix: "Use sk_test_… for Preview and sk_live_… only for Production.",
    });
  }
  const whsec = process.env.STRIPE_WEBHOOK_SECRET || "";
  add({
    group: "Stripe",
    name: "STRIPE_WEBHOOK_SECRET",
    ok: whsec.startsWith("whsec_"),
    detail: !whsec ? "Missing" : whsec.startsWith("whsec_") ? "Set" : "Set, but doesn't start with whsec_",
    fix: "Stripe → Developers → Webhooks → endpoint " + (site || "https://your-site") + "/api/payments/stripe/webhook → Signing secret.",
  });

  // Cron
  add({
    group: "Automation",
    name: "CRON_SECRET",
    ok: has("CRON_SECRET"),
    detail: has("CRON_SECRET") ? "Set" : "Missing: the daily job (capture held payments, auto refunds, tracking) won't run",
    fix: "Add any long random text as CRON_SECRET.",
  });

  // EasyParcel
  const epId = has("EASYPARCEL_CLIENT_ID") && has("EASYPARCEL_CLIENT_SECRET");
  add({
    group: "EasyParcel",
    name: "EASYPARCEL_CLIENT_ID / EASYPARCEL_CLIENT_SECRET",
    ok: epId,
    detail: epId ? "Set" : "Missing",
    fix: "Copy them from EasyParcel Developer Hub → your app.",
  });
  add({
    group: "EasyParcel",
    name: "EASYPARCEL_WEBHOOK_KEY",
    ok: has("EASYPARCEL_WEBHOOK_KEY"),
    detail: has("EASYPARCEL_WEBHOOK_KEY") ? "Set" : "Missing: tracking updates will only come from the daily job",
    fix: "Add any long random text, and use it in the webhook URL …/api/easyparcel/webhook?key=<it>.",
  });
  if (epId && site) {
    add({
      group: "EasyParcel",
      name: "Redirect URL to register in Developer Hub",
      ok: true,
      detail: (process.env.EASYPARCEL_REDIRECT_URI || site + "/api/easyparcel/callback"),
    });
  }
  if (adminOk) {
    const status = await easyParcelStatus().catch(() => null);
    add({
      group: "EasyParcel",
      name: "Account connected",
      ok: Boolean(status?.connected),
      detail: !status?.ready
        ? "Run supabase/RUN-ALL.sql first"
        : status.connected
          ? "Connected " + (status.connectedAt ? new Date(status.connectedAt).toLocaleString("en-MY") : "")
          : "Not connected yet",
      fix: "Admin → Shipping settings → Connect EasyParcel.",
    });
  }

  return NextResponse.json({
    environment: vercelEnv,
    commit: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    checkedAt: new Date().toISOString(),
    checks,
  });
}
