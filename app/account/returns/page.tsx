"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import { useT } from "@/components/LanguageProvider";
import { friendlyError } from "@/lib/i18n/errors";
import { intlTag } from "@/lib/i18n/format";
import type { Key } from "@/lib/i18n";
import styles from "./Returns.module.css";

type Row = {
  id: string;
  request_number: string;
  order_id: string;
  reason: string;
  status: string;
  requested_amount: number | string;
  final_amount: number | string | null;
  created_at: string;
};

function statusClass(status: string) {
  if (status === "refunded") return styles.status + " " + styles.statusDone;
  if (["rejected", "cancelled", "closed"].includes(status)) return styles.status + " " + styles.statusOff;
  return styles.status;
}

export default function MyReturnsPage() {
  const t = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [orders, setOrders] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          window.location.href = "/login?next=/account/returns";
          return;
        }
        const { data, error: listError } = await supabase
          .from("return_requests")
          .select("id, request_number, order_id, reason, status, requested_amount, final_amount, created_at")
          .eq("customer_id", user.id)
          .order("created_at", { ascending: false });
        if (listError) throw listError;
        const list = (data || []) as Row[];
        const orderIds = Array.from(new Set(list.map((r) => r.order_id)));
        if (orderIds.length) {
          const { data: orderRows } = await supabase.from("orders").select("id, order_number").in("id", orderIds);
          setOrders(new Map(((orderRows || []) as Array<{ id: string; order_number: string }>).map((o) => [o.id, o.order_number])));
        }
        setRows(list);
      } catch (caught) {
        setError(friendlyError(caught, t, "ret.loadError"));
        setRows([]);
      }
    })();
  }, [t]);

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <Link href="/account" className={styles.back}>
          ‹ {t("me.title")}
        </Link>
        <h1 className={styles.title}>{t("ret.myReturns")}</h1>
        {error ? <p className={styles.error}>{error}</p> : null}
        {rows === null ? (
          <div className={styles.card}>{t("common.loading")}</div>
        ) : rows.length === 0 ? (
          <div className={styles.empty}>{t("ret.empty")}</div>
        ) : (
          <div className={styles.list}>
            {rows.map((row) => (
              <Link key={row.id} href={"/account/returns/" + row.id} className={styles.listItem}>
                <span className={styles.listText}>
                  <strong>{t(("ret.r." + row.reason) as Key)}</strong>
                  <small>
                    {row.request_number} · {t("ret.order", { n: orders.get(row.order_id) || "" })} ·{" "}
                    {new Date(row.created_at).toLocaleDateString(intlTag(), { day: "2-digit", month: "short" })}
                  </small>
                  <span className={statusClass(row.status)}>{t(("ret.st." + row.status) as Key)}</span>
                </span>
                <span className={styles.amount}>{formatPrice(Number(row.final_amount ?? row.requested_amount))}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
