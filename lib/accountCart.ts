"use client";

import { createClient } from "@/lib/supabase/client";
import type { Product, ProductVariant } from "@/data/products";

export type AccountCartLine = {
  lineId: string;
  product: Product;
  variant?: ProductVariant;
  quantity: number;
};

async function getOrCreateCartId(userId: string) {
  const supabase = createClient();

  const { data: existing, error: findError } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (findError) throw findError;
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from("carts")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (error) {
    const { data: retry, error: retryError } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (retryError) throw error;
    return retry.id as string;
  }

  return data.id as string;
}

export async function loadAccountCart(): Promise<AccountCartLine[]> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data: cart, error: cartError } = await supabase
    .from("carts")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (cartError) throw cartError;
  if (!cart?.id) return [];

  const { data, error } = await supabase
    .from("cart_items")
    .select(
      "line_id, quantity, product_snapshot, variant_snapshot, created_at"
    )
    .eq("cart_id", cart.id)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data || [])
    .filter(
      (row) =>
        typeof row.line_id === "string" &&
        row.product_snapshot &&
        typeof row.quantity === "number"
    )
    .map((row) => ({
      lineId: row.line_id as string,
      product: row.product_snapshot as Product,
      variant: row.variant_snapshot
        ? (row.variant_snapshot as ProductVariant)
        : undefined,
      quantity: Math.max(1, Number(row.quantity || 1)),
    }));
}

export async function saveAccountCart(lines: AccountCartLine[]) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const cartId = await getOrCreateCartId(user.id);

  const { error: deleteError } = await supabase
    .from("cart_items")
    .delete()
    .eq("cart_id", cartId);

  if (deleteError) throw deleteError;

  if (lines.length > 0) {
    const { error: insertError } = await supabase
      .from("cart_items")
      .insert(
        lines.map((line) => ({
          cart_id: cartId,
          variant_id: line.variant?.id || null,
          line_id: line.lineId,
          product_snapshot: line.product,
          variant_snapshot: line.variant || null,
          quantity: Math.max(1, Math.floor(line.quantity || 1)),
          updated_at: new Date().toISOString(),
        }))
      );

    if (insertError) throw insertError;
  }

  await supabase
    .from("carts")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", cartId);
}
