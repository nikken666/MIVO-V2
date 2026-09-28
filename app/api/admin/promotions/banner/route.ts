import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "campaign-banners";
const MAX_FILE_SIZE = 8 * 1024 * 1024;
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

    const { data: isAdmin, error: adminCheckError } = await supabase.rpc(
      "is_admin"
    );

    if (adminCheckError) throw adminCheckError;

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("image");
    const kind = String(formData.get("kind") || "desktop").toLowerCase();

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose an image to upload." },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only JPG, PNG and WEBP images are supported." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Banner image must be 8MB or smaller." },
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

    const path =
      kind.replace(/[^a-z0-9-]/g, "") +
      "/" +
      new Date().toISOString().slice(0, 10) +
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

    const { data } = admin.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({
      url: data.publicUrl,
      path,
    });
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : "Unable to upload campaign banner.";

    console.error("MIVO campaign banner upload failed", {
      message,
      caught,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
