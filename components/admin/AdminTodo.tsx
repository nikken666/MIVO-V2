"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/admin/Admin.module.css";

type Todo = { key: string; label: string; hint: string; href: string; count: number };

/** Dashboard: the things only MIVO can unblock, biggest first. Empty ones fade out. */
export default function AdminTodo() {
  const [todos, setTodos] = useState<Todo[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const count = (q: PromiseLike<{ count: number | null }>) =>
        Promise.resolve(q).then((r) => r.count || 0, () => 0);
      const [apps, returns, claims, toShip, chats] = await Promise.all([
        count(supabase.from("seller_applications").select("id", { count: "exact", head: true }).eq("status", "submitted")),
        count(supabase.from("return_requests").select("id", { count: "exact", head: true }).eq("status", "mivo_review")),
        count(supabase.from("warranty_claims").select("id", { count: "exact", head: true }).in("status", ["new", "reviewing"])),
        count(
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("payment_status", "paid")
            .in("status", ["paid", "processing", "packed"])
        ),
        Promise.resolve(supabase.from("chat_conversations").select("seller_unread").gt("seller_unread", 0)).then(
          (r) => ((r.data || []) as Array<{ seller_unread: number }>).length,
          () => 0
        ),
      ]);
      if (!active) return;
      setTodos([
        { key: "apps", label: "Seller applications", hint: "Shops waiting for approval", href: "/admin/shops/applications", count: apps },
        { key: "returns", label: "Return disputes", hint: "Waiting for MIVO's decision", href: "/admin/returns", count: returns },
        { key: "claims", label: "Warranty claims", hint: "New or in review", href: "/admin/claims", count: claims },
        { key: "ship", label: "To ship", hint: "Paid orders not shipped yet", href: "/admin/arrange-shipment", count: toShip },
        { key: "chat", label: "Unread chats", hint: "Customers waiting for a reply", href: "/admin/chat", count: chats },
      ]);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!todos) return null;
  const sorted = [...todos].sort((a, b) => Number(b.count > 0) - Number(a.count > 0));
  const total = todos.reduce((sum, t) => sum + t.count, 0);

  return (
    <section className={styles.todoPanel} aria-label="To do">
      <div className={styles.todoHead}>
        <h2>To do</h2>
        <span>{total ? total + " waiting" : "All clear ✓"}</span>
      </div>
      <div className={styles.todoGrid}>
        {sorted.map((t) => (
          <a key={t.key} href={t.href} className={styles.todoCard + (t.count ? " " + styles.todoHot : "")}>
            <strong>{t.count}</strong>
            <span>{t.label}</span>
            <small>{t.hint}</small>
          </a>
        ))}
      </div>
    </section>
  );
}
