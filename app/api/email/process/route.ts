import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { processEmailQueue } from "@/lib/email/queue";

export const maxDuration = 60;

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// POST: the database asks us to send right away (supabase/customer-emails.sql, pg_net).
export async function POST(request: NextRequest) {
  const secret = process.env.EMAIL_QUEUE_SECRET || "";
  if (secret.length < 16 || !same(request.headers.get("x-mivo-email-secret") || "", secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processEmailQueue({ limit: 40, deadlineMs: 45_000 }).catch((e) => ({ error: String(e?.message || e) }));
  return NextResponse.json(result);
}

// GET: Vercel's daily check sends anything still waiting.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  if (!secret || !same(request.headers.get("authorization") || "", "Bearer " + secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await processEmailQueue({ limit: 80, deadlineMs: 50_000 }).catch((e) => ({ error: String(e?.message || e) }));
  return NextResponse.json(result);
}
