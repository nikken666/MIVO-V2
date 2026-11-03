"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type MyShop = {
  id: string;
  shop_name: string;
  slug: string | null;
  status: string;
  tier: string | null;
  logo_url: string | null;
  commission_rate: number | string | null;
};

/** Signed-in seller with their shops; sends others to sign in or apply. */
export function useMyShops() {
  const [shops, setShops] = useState<MyShop[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
        return;
      }
      const { data, error: shopError } = await supabase.rpc("seller_my_shops");
      if (shopError) {
        setError(/seller_my_shops/.test(shopError.message) ? "Run supabase/seller-centre.sql in Supabase to turn on Seller Centre." : shopError.message);
        setShops([]);
        return;
      }
      const list = (data || []) as MyShop[];
      if (!list.length) {
        window.location.href = "/sell";
        return;
      }
      setShops(list);
    })();
  }, []);

  return { shops, error };
}
