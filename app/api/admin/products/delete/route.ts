import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Delete draft products in bulk (Products → Draft). Only drafts are deleted:
 * live, sold-out or delisted products are left alone, and so is anything a
 * customer has ordered. The server checks the user may manage the shops.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const { ids } = (await request.json()) as { ids?: string[] };
    const list = Array.from(new Set((ids || []).filter((id) => typeof id === "string" && id))).slice(0, 5000);
    if (!list.length) return NextResponse.json({ error: "Choose products first." }, { status: 400 });

    const admin = createAdminClient();
    const { data: isAdmin } = await supabase.rpc("is_admin");
    const mine = new Set<string>();
    if (!isAdmin) {
      const { data: shops } = await admin.from("sellers").select("id").eq("owner_id", user.id).eq("status", "approved");
      (shops || []).forEach((s) => mine.add(s.id as string));
    }

    let deleted = 0;
    let kept = 0;
    const storagePaths: string[] = [];
    for (let i = 0; i < list.length; i += 200) {
      const chunk = list.slice(i, i + 200);
      const { data: rows } = await admin.from("products").select("id, seller_id, status").in("id", chunk);
      const drafts = (rows || []).filter((r) => r.status === "draft" && (isAdmin || mine.has(r.seller_id as string))).map((r) => r.id as string);
      kept += chunk.length - drafts.length;
      if (!drafts.length) continue;

      // Never delete something a customer ordered.
      const { data: ordered } = await admin.from("order_items").select("product_id").in("product_id", drafts);
      const orderedIds = new Set((ordered || []).map((r) => r.product_id as string));
      const removable = drafts.filter((id) => !orderedIds.has(id));
      kept += drafts.length - removable.length;
      if (!removable.length) continue;

      const { data: images } = await admin.from("product_images").select("image_url").in("product_id", removable);
      for (const img of images || []) {
        const match = /\/storage\/v1\/object\/public\/product-images\/(.+)$/.exec(String(img.image_url || ""));
        if (match) storagePaths.push(decodeURIComponent(match[1]));
      }
      await admin.from("product_images").delete().in("product_id", removable);
      await admin.from("product_vehicle_fitments").delete().in("product_id", removable);
      await admin.from("voucher_products").delete().in("product_id", removable);
      await admin.from("product_variants").delete().in("product_id", removable);
      const { data: gone, error } = await admin.from("products").delete().in("id", removable).eq("status", "draft").select("id");
      if (error) throw error;
      deleted += (gone || []).length;
    }
    if (storagePaths.length) {
      for (let i = 0; i < storagePaths.length; i += 500) {
        await admin.storage.from("product-images").remove(storagePaths.slice(i, i + 500));
      }
    }
    return NextResponse.json({ deleted, kept });
  } catch (caught) {
    const e = caught as { message?: string };
    return NextResponse.json({ error: e?.message || "Could not delete products." }, { status: 500 });
  }
}
