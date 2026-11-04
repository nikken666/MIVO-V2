"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "./LanguageProvider";

/** "Email me promotions" switch on the Me page. Order emails are not affected. */
export default function MarketingOptIn({ className = "" }: { className?: string }) {
  const t = useT();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase.rpc("my_marketing_opt_in");
      if (!active || error || !data) return; // supabase/customer-emails.sql not run yet: hide
      const status = data as { on: boolean; decided: boolean };
      // Ticked "send me promotions" when registering: apply it once.
      if (!status.decided) {
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user?.user_metadata?.marketing_opt_in === true) {
          await supabase.rpc("set_marketing_opt_in", { p_on: true });
          if (active) setOn(true);
          return;
        }
      }
      setOn(Boolean(status.on));
    })();
    return () => {
      active = false;
    };
  }, []);

  if (on === null) return null;

  async function toggle(next: boolean) {
    setBusy(true);
    setOn(next);
    const { error } = await createClient().rpc("set_marketing_opt_in", { p_on: next });
    if (error) setOn(!next);
    setBusy(false);
  }

  return (
    <label className={className} style={{ cursor: "pointer" }}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 6h16v12H4z" />
        <path d="m4 7 8 6 8-6" />
      </svg>
      <strong>
        {t("me.promoEmails")}
        <small style={{ display: "block", fontWeight: 400, fontSize: 12, color: "#7b8084" }}>{t("me.promoEmailsHint")}</small>
      </strong>
      <input
        type="checkbox"
        role="switch"
        className="mivoSwitch"
        checked={on}
        disabled={busy}
        onChange={(event) => void toggle(event.target.checked)}
      />
    </label>
  );
}
