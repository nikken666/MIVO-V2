import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffAccess = {
  allowed: boolean;
  isAdmin: boolean;
  isSuperadmin: boolean;
  /** Approved shops this account owns (sellers). Admins see every shop. */
  shopIds: string[];
};

/** MIVO admin, or a seller who owns at least one approved shop. */
export async function getStaffAccess(supabase: SupabaseClient): Promise<StaffAccess> {
  const [{ data: isAdmin }, superadmin, shops] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase.rpc("is_superadmin").then((r) => r, () => ({ data: false })),
    supabase.rpc("seller_my_shops").then((r) => r, () => ({ data: [] })),
  ]);
  const shopIds = ((shops as { data: unknown }).data as Array<{ id: string; status: string }> | null || [])
    .filter((s) => s.status === "approved")
    .map((s) => s.id);
  return {
    allowed: Boolean(isAdmin) || shopIds.length > 0,
    isAdmin: Boolean(isAdmin),
    isSuperadmin: Boolean((superadmin as { data: unknown }).data),
    shopIds,
  };
}
