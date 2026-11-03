import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SLOTS = new Set(["ic_front", "ic_back", "ssm", "bank_statement", "other"]);
const BUCKET = "seller-documents";

/**
 * Seller application documents: hands the signed-in applicant a one-time
 * upload link for their own private folder. The upload then doesn't depend
 * on the storage table's policies (which can fail for shoppers who aren't
 * sellers yet).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const { slot, ext } = (await request.json()) as { slot?: string; ext?: string };
    if (!slot || !SLOTS.has(slot)) return NextResponse.json({ error: "Unknown document." }, { status: 400 });
    const safeExt = String(ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";

    const admin = createAdminClient();
    const { data: bucket } = await admin.storage.getBucket(BUCKET);
    if (!bucket) {
      await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 10 * 1024 * 1024 });
    }

    const path = user.id + "/" + slot + "-" + crypto.randomUUID() + "." + safeExt;
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new Error(error?.message || "Couldn't prepare the upload.");
    return NextResponse.json({ path, token: data.token });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Couldn't prepare the upload." },
      { status: 500 }
    );
  }
}
