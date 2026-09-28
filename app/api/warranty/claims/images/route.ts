import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "warranty-claim-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const orderNumber = String(formData.get("orderNumber") || "").trim();
    const orderItemId = String(formData.get("orderItemId") || "").trim();
    const files = formData
      .getAll("images")
      .filter((value): value is File => value instanceof File);

    if (!orderNumber || !orderItemId) {
      return NextResponse.json(
        { error: "Missing order or product." },
        { status: 400 }
      );
    }

    if (files.length < 1 || files.length > 5) {
      return NextResponse.json(
        { error: "Upload between 1 and 5 photos." },
        { status: 400 }
      );
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: "Only JPG, PNG and WEBP photos are allowed." },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Each photo must be 5MB or smaller." },
          { status: 400 }
        );
      }
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, created_at, paid_at")
      .eq("order_number", orderNumber)
      .eq("user_id", user.id)
      .eq("status", "delivered")
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Delivered order not found." },
        { status: 404 }
      );
    }

    const { data: item, error: itemError } = await supabase
      .from("order_items")
      .select("id, warranty_months")
      .eq("id", orderItemId)
      .eq("order_id", order.id)
      .maybeSingle();

    if (itemError || !item) {
      return NextResponse.json(
        { error: "Order item not found." },
        { status: 404 }
      );
    }

    const months = Number(item.warranty_months || 0);

    if (months <= 0) {
      return NextResponse.json(
        { error: "This item does not have warranty coverage." },
        { status: 400 }
      );
    }

    const { data: deliveredHistory } = await supabase
      .from("order_status_history")
      .select("created_at")
      .eq("order_id", order.id)
      .eq("new_status", "delivered")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const startAt = new Date(
      deliveredHistory?.created_at || order.paid_at || order.created_at
    );
    const expiry = new Date(startAt);
    const day = expiry.getDate();

    expiry.setDate(1);
    expiry.setMonth(expiry.getMonth() + months);
    const lastDay = new Date(
      expiry.getFullYear(),
      expiry.getMonth() + 1,
      0
    ).getDate();
    expiry.setDate(Math.min(day, lastDay));

    if (Date.now() > expiry.getTime()) {
      return NextResponse.json(
        { error: "The warranty for this item has expired." },
        { status: 400 }
      );
    }

    const { data: activeClaim } = await supabase
      .from("warranty_claims")
      .select("id")
      .eq("order_item_id", orderItemId)
      .eq("user_id", user.id)
      .in("status", ["new", "reviewing", "approved"])
      .limit(1)
      .maybeSingle();

    if (activeClaim) {
      return NextResponse.json(
        { error: "There is already an active warranty claim for this item." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error: bucketError } = await admin.storage.getBucket(BUCKET);

    if (bucketError) {
      const { error: createBucketError } = await admin.storage.createBucket(
        BUCKET,
        {
          public: true,
          fileSizeLimit: MAX_FILE_SIZE,
          allowedMimeTypes: Array.from(ALLOWED_TYPES),
        }
      );

      if (
        createBucketError &&
        !createBucketError.message.toLowerCase().includes("already")
      ) {
        throw createBucketError;
      }
    }

    const urls: string[] = [];

    for (const file of files) {
      const path =
        user.id +
        "/" +
        order.id +
        "/" +
        orderItemId +
        "/" +
        crypto.randomUUID() +
        "." +
        extensionFor(file.type);

      const bytes = new Uint8Array(await file.arrayBuffer());

      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(path, bytes, {
          contentType: file.type,
          upsert: false,
          cacheControl: "31536000",
        });

      if (uploadError) throw uploadError;

      const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(path);
      urls.push(publicUrl.publicUrl);
    }

    return NextResponse.json({ urls });
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : "Unable to upload warranty claim photos.";

    console.error("MIVO warranty claim image upload failed", {
      message,
      caught,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
