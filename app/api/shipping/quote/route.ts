import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { quoteCheckout } from "@/lib/easyparcel/checkoutQuote";

/**
 * Checkout: live EasyParcel shipping per shop. 409 means "use MIVO's own
 * shipping rules instead" (EasyParcel not connected, no pickup address, …).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!process.env.EASYPARCEL_CLIENT_ID) return NextResponse.json({ fallback: true }, { status: 409 });

  const body = (await request.json().catch(() => ({}))) as {
    items?: Array<{ variant_id: string; quantity: number }>;
    state?: string;
    postcode?: string;
  };
  try {
    const result = await quoteCheckout(user.id, body.items || [], { state: body.state || "", postcode: body.postcode || "" });
    return NextResponse.json(result);
  } catch (caught) {
    return NextResponse.json(
      { fallback: true, reason: caught instanceof Error ? caught.message : String(caught) },
      { status: 409 }
    );
  }
}
