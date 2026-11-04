import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkUnsubscribeToken } from "@/lib/email/queue";
import { siteUrl } from "@/lib/email/mailer";

async function unsubscribe(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("u") || "";
  const token = request.nextUrl.searchParams.get("t") || "";
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !checkUnsubscribeToken(userId, token)) return false;
  const { error } = await createAdminClient().from("profiles").update({ marketing_opt_in: false, marketing_opt_in_at: new Date().toISOString() }).eq("id", userId);
  return !error;
}

function page(ok: boolean) {
  const title = ok ? "You're unsubscribed · Anda telah berhenti melanggan · 已退订" : "Link not valid · Pautan tidak sah · 链接无效";
  const text = ok
    ? "You won't get MIVO promotions any more. Order and delivery emails still come.<br>Anda tidak akan menerima promosi MIVO lagi. E-mel pesanan dan penghantaran masih dihantar.<br>你不会再收到 MIVO 促销邮件，订单和物流通知照常发送。"
    : "Please use the link in the latest email, or turn promotions off in your MIVO account.";
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MIVO</title></head><body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f2f4f6;color:#1d1d1f"><div style="max-width:520px;margin:60px auto;padding:28px;background:#fff;border-radius:18px"><h1 style="font-size:20px;margin:0 0 12px">${title}</h1><p style="line-height:1.7;color:#3a3d40">${text}</p><p><a href="${siteUrl()}" style="color:#0071e3">MIVO</a></p></div></body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: NextRequest) {
  return page(await unsubscribe(request));
}

// One-click unsubscribe from the mail app's own button (List-Unsubscribe-Post).
export async function POST(request: NextRequest) {
  const ok = await unsubscribe(request);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
