import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { easyParcelStatus } from "@/lib/easyparcel/oauth";
import { wallet } from "@/lib/easyparcel/api";

/** MIVO admin: is EasyParcel connected, and the wallet balance. */
export async function GET() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const configured = Boolean(process.env.EASYPARCEL_CLIENT_ID && process.env.EASYPARCEL_CLIENT_SECRET);
  const status = await easyParcelStatus();
  let balance: number | null = null;
  let walletError: string | null = null;
  if (configured && status.connected) {
    balance = await wallet().catch((caught) => {
      walletError = caught instanceof Error ? caught.message : String(caught);
      return null;
    });
  }
  return NextResponse.json({ configured, ...status, balance, walletError });
}
