import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendMail, siteUrl } from "@/lib/email/mailer";
import { processEmailQueue, unsubscribeToken } from "@/lib/email/queue";
import { campaignEmail, lang, type Campaign } from "@/lib/email/templates";

export const maxDuration = 60;

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return isAdmin ? user : null;
}

function cleanCampaign(input: Partial<Campaign> | undefined): Campaign | string {
  const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const url = (v: unknown) => {
    const value = text(v, 1000);
    return value && !/^https?:\/\//i.test(value) ? "bad" : value;
  };
  const c = {
    subject: text(input?.subject, 150),
    headline: text(input?.headline, 150) || null,
    body: text(input?.body, 6000),
    image_url: url(input?.image_url) || null,
    button_text: text(input?.button_text, 40) || null,
    button_url: url(input?.button_url) || null,
  };
  if (!c.subject) return "Write a subject line.";
  if (!c.body) return "Write the message.";
  if (c.image_url === "bad" || c.button_url === "bad") return "Links must start with https://";
  if (c.button_text && !c.button_url) return "Add the button link, or clear the button text.";
  return c;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const admin = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const count = async (build: (q: any) => any) => {
    const { count: n, error } = await build(admin.from("email_queue").select("id", { count: "exact", head: true }));
    return error ? null : n || 0;
  };
  const [pending, failed, sent24h, subscribers, campaigns, recent] = await Promise.all([
    count((q) => q.in("status", ["pending", "sending"])),
    count((q) => q.eq("status", "failed")),
    count((q) => q.eq("status", "sent").gte("sent_at", since)),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("marketing_opt_in", true).then((r) => (r.error ? null : r.count || 0)),
    admin.from("email_campaigns").select("id, subject, recipients, created_at").order("created_at", { ascending: false }).limit(20),
    admin.from("email_queue").select("kind, status, recipient, last_error, created_at, sent_at").order("created_at", { ascending: false }).limit(30),
  ]);

  // Sent / waiting per promotion.
  const list = (campaigns.data || []) as Array<{ id: string; subject: string; recipients: number; created_at: string }>;
  const withCounts = await Promise.all(
    list.map(async (c) => {
      const { count: sent } = await admin.from("email_queue").select("id", { count: "exact", head: true }).eq("campaign_id", c.id).eq("status", "sent");
      return { ...c, sent: sent || 0 };
    })
  );

  return NextResponse.json({
    configured: emailConfigured(),
    from: process.env.EMAIL_FROM || process.env.SMTP_USER || null,
    instant: Boolean(process.env.EMAIL_QUEUE_SECRET),
    dailyLimit: Number(process.env.EMAIL_DAILY_LIMIT || 450),
    tablesReady: pending !== null,
    pending,
    failed,
    sent24h,
    subscribers,
    campaigns: withCounts,
    recent: recent.data || [],
  });
}

export async function POST(request: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { action?: string; campaign?: Partial<Campaign> };
  const admin = createAdminClient();

  try {
    if (body.action === "process") {
      const result = await processEmailQueue({ limit: 25, deadlineMs: 45_000 });
      const { count } = await admin.from("email_queue").select("id", { count: "exact", head: true }).in("status", ["pending", "sending"]);
      return NextResponse.json({ ...result, remaining: count || 0 });
    }

    const campaign = cleanCampaign(body.campaign);
    if (typeof campaign === "string") return NextResponse.json({ error: campaign }, { status: 400 });
    if (!emailConfigured()) {
      return NextResponse.json({ error: "Email isn't set up yet: add SMTP_USER and SMTP_PASS in Vercel, then redeploy." }, { status: 400 });
    }

    if (body.action === "test") {
      const { data: profile } = await admin.from("profiles").select("full_name, preferred_language").eq("id", user.id).maybeSingle();
      const to = user.email || "";
      if (!to) return NextResponse.json({ error: "Your account has no email." }, { status: 400 });
      const mail = campaignEmail(
        siteUrl(),
        lang(profile?.preferred_language),
        campaign,
        (profile?.full_name as string) || to.split("@")[0],
        siteUrl() + "/api/email/unsubscribe?u=" + user.id + "&t=" + unsubscribeToken(user.id)
      );
      await sendMail({ to, ...mail, subject: "[TEST] " + mail.subject });
      return NextResponse.json({ ok: true, to });
    }

    if (body.action === "send") {
      const { data: created, error } = await admin
        .from("email_campaigns")
        .insert({ ...campaign, created_by: user.id })
        .select("id")
        .single();
      if (error) throw error;
      const { data: queued, error: queueError } = await admin.rpc("mivo_queue_campaign", { p_campaign: created.id });
      if (queueError) throw queueError;
      return NextResponse.json({ ok: true, id: created.id, recipients: queued || 0 });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String((caught as { message?: string })?.message || caught);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
