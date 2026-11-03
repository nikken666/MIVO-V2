import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Publish / delist products in bulk (Products page). Written by the server
 * after checking the user is a MIVO admin or owns every product's shop, so it
 * doesn't depend on the live database's row rules for products.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const { ids, status } = (await request.json()) as { ids?: string[]; status?: string };
    const list = Array.from(new Set((ids || []).filter((id) => typeof id === "string" && id))).slice(0, 5000);
    if (!list.length) return NextResponse.json({ error: "Choose products first." }, { status: 400 });
    if (status !== "active" && status !== "inactive") return NextResponse.json({ error: "Unknown status." }, { status: 400 });

    const admin = createAdminClient();
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      const { data: shops } = await admin.from("sellers").select("id").eq("owner_id", user.id).eq("status", "approved");
      const mine = new Set((shops || []).map((s) => s.id as string));
      for (let i = 0; i < list.length; i += 300) {
        const { data: rows } = await admin.from("products").select("id, seller_id").in("id", list.slice(i, i + 300));
        if ((rows || []).some((r) => !mine.has(r.seller_id as string))) {
          return NextResponse.json({ error: "You can only change your own shop's products." }, { status: 403 });
        }
      }
    }

    let changed = 0;
    const now = new Date().toISOString();
    for (let i = 0; i < list.length; i += 300) {
      const { data, error } = await admin
        .from("products")
        .update(status === "active" ? { status, published_at: now } : { status })
        .in("id", list.slice(i, i + 300))
        .neq("status", status)
        .select("id");
      if (error) throw error;
      changed += (data || []).length;
    }
    return NextResponse.json({ changed });
  } catch (caught) {
    const e = caught as { message?: string };
    return NextResponse.json({ error: e?.message || "Could not update products." }, { status: 500 });
  }
}
