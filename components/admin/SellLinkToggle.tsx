"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/admin/Admin.module.css";

/** Superadmin: show or hide "Sell on MIVO" on the site. /sell keeps working either way. */
export default function SellLinkToggle() {
  const [superadmin, setSuperadmin] = useState(false);
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    void supabase.rpc("is_superadmin").then(({ data }) => setSuperadmin(Boolean(data)));
    void supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "show_sell_link")
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (loadError) setError("Run supabase/RUN-NEW.sql to turn on this switch.");
        setOn(data?.value === true);
      });
  }, []);

  async function toggle() {
    const next = !on;
    const { error: saveError } = await createClient().rpc("platform_set_setting", { p_key: "show_sell_link", p_value: next });
    if (saveError) setError(saveError.message);
    else setOn(next);
  }

  if (!superadmin || on === null) return null;
  return (
    <section className={styles.adminPanel} style={{ marginBottom: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 240 }}>
        <strong>&ldquo;Sell on MIVO&rdquo; link</strong>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#5f656a" }}>
          {on
            ? "Shown in the site footer: anyone can find the seller sign-up page."
            : "Hidden. The sign-up page still works at /sell for people you send the link to."}
        </p>
        {error ? <p className={styles.adminError}>{error}</p> : null}
      </div>
      <button type="button" className={on ? styles.adminSecondaryAction : styles.adminAction} onClick={() => void toggle()}>
        {on ? "Hide link" : "Show link"}
      </button>
    </section>
  );
}
