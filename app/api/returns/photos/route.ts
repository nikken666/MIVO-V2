import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Return photos go through the server: uploading straight to storage from
// the browser runs every storage rule of the site, and one of them reads the
// shops table, which shoppers can't read ("permission denied for table sellers").
const BUCKET = "return-evidence";
const MAX_SIZE = 4 * 1024 * 1024; // the site shrinks photos to ~1 MB first
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

async function signedUrls(admin: ReturnType<typeof createAdminClient>, paths: string[]) {
  if (!paths.length) return [];
  const { data } = await admin.storage.from(BUCKET).createSignedUrls(paths, 3600);
  return (data || []).map((s) => s.signedUrl).filter(Boolean) as string[];
}

/** Upload one photo. Fields: file, orderNumber. Returns its storage path and a preview URL. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    const orderNumber = String(form.get("orderNumber") || "").trim();
    if (!(file instanceof File)) return NextResponse.json({ error: "No photo." }, { status: 400 });
    const ext = TYPES[file.type];
    if (!ext) return NextResponse.json({ error: "Only JPG, PNG, WEBP or HEIC photos." }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: "That photo is too large." }, { status: 413 });

    const admin = createAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("id, order_number")
      .eq("order_number", orderNumber)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const path = user.id + "/" + order.order_number + "-" + crypto.randomUUID() + "." + ext;
    const { error } = await admin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const [preview] = await signedUrls(admin, [path]);
    return NextResponse.json({ path, preview: preview || null });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Upload failed." }, { status: 500 });
  }
}

/** Photos of a return request (?id=…) for its customer, the shop or MIVO. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const id = request.nextUrl.searchParams.get("id") || "";
    const admin = createAdminClient();
    const { data: row } = await admin.from("return_requests").select("*").eq("id", id).maybeSingle();
    const r = row as Record<string, unknown> | null;
    if (!r) return NextResponse.json({ error: "Not found." }, { status: 404 });
    let allowed = r.customer_id === user.id;
    if (!allowed) {
      const { data: isAdmin } = await supabase.rpc("is_admin");
      allowed = Boolean(isAdmin);
    }
    if (!allowed && r.seller_id) {
      const { data: shop } = await admin.from("sellers").select("owner_id").eq("id", r.seller_id as string).maybeSingle();
      allowed = shop?.owner_id === user.id;
    }
    if (!allowed) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    const [evidence, parcel] = await Promise.all([
      signedUrls(admin, ((r.evidence_paths as string[] | null) || []).filter(Boolean)),
      signedUrls(admin, ((r.return_parcel_photos as string[] | null) || []).filter(Boolean)),
    ]);
    return NextResponse.json({ evidence, parcel });
  } catch (caught) {
    return NextResponse.json({ error: caught instanceof Error ? caught.message : "Couldn't load photos." }, { status: 500 });
  }
}
