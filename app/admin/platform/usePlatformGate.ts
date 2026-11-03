"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Superadmin-only pages. */
export function usePlatformGate() {
  const [ready, setReady] = useState(false);
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
      const { data, error: rpcError } = await supabase.rpc("is_superadmin");
      if (rpcError) {
        setError("Run supabase/superadmin.sql and supabase/platform.sql in Supabase first.");
        return;
      }
      if (!data) {
        window.location.href = "/admin";
        return;
      }
      setReady(true);
    })();
  }, []);
  return { ready, error };
}

export const toLocalInput = (d: Date) => {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
};
export const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-MY", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
