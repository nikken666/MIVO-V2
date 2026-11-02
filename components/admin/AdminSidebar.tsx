"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/admin/Admin.module.css";

type NavItem = { href: string; label: string; badge?: "toShip" | "chat" | "returns" };
type NavGroup = { title: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    title: "Orders",
    items: [
      { href: "/admin/orders", label: "My orders", badge: "toShip" },
      { href: "/admin/arrange-shipment", label: "Arrange shipment" },
      { href: "/admin/returns", label: "Returns & refunds", badge: "returns" },
      { href: "/admin/claims", label: "Warranty claims" },
    ],
  },
  {
    title: "Products",
    items: [
      { href: "/admin/products", label: "My products" },
      { href: "/admin/products/new", label: "Add new product" },
      { href: "/admin/products/import", label: "Import from Shopee" },
      { href: "/admin/products/fitment-suggestions", label: "Vehicle fitment" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { href: "/admin/marketing", label: "Marketing centre" },
      { href: "/admin/marketing/vouchers", label: "Vouchers" },
      { href: "/admin/marketing/discounts", label: "Discounts" },
      { href: "/admin/marketing/campaigns", label: "Campaigns" },
    ],
  },
  {
    title: "Customer service",
    items: [{ href: "/admin/chat", label: "Chat", badge: "chat" }],
  },
  {
    title: "Shop",
    items: [
      { href: "/admin/shops", label: "My shops" },
      { href: "/admin/shipping", label: "Shipping settings" },
      { href: "/admin/store-health", label: "Store health" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  // The most specific matching link wins.
  const all = groups.flatMap((g) => g.items.map((i) => i.href));
  const matches = all.filter((h) => pathname === h || pathname.startsWith(h + "/"));
  const best = matches.sort((a, b) => b.length - a.length)[0];
  return best === href;
}

/** Shared Seller Centre sidebar: grouped menu, live badges, signed-in admin. */
export default function AdminSidebar() {
  const pathname = usePathname() || "/admin";
  const [me, setMe] = useState<{ name: string; avatar: string | null; email: string }>({
    name: "",
    avatar: null,
    email: "",
  });
  const [badges, setBadges] = useState<{ toShip: number; chat: number; returns: number }>({ toShip: 0, chat: 0, returns: 0 });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;

      const [{ data: profile }, toShip, chats, returns] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle(),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("payment_status", "paid")
          .in("status", ["paid", "processing", "packed"]),
        supabase.from("chat_conversations").select("seller_unread").gt("seller_unread", 0),
        supabase
          .from("return_requests")
          .select("id", { count: "exact", head: true })
          .in("status", ["requested", "mivo_review", "refunding", "returning"]),
      ]);
      if (!active) return;

      const p = (profile || {}) as { full_name?: string | null; avatar_url?: string | null };
      setMe({
        name: p.full_name?.trim() || user.email?.split("@")[0] || "Admin",
        avatar: p.avatar_url || null,
        email: user.email || "",
      });
      setBadges({
        toShip: toShip.count || 0,
        returns: returns.count || 0,
        chat: ((chats.data || []) as Array<{ seller_unread: number }>).reduce(
          (sum, row) => sum + (row.seller_unread || 0),
          0
        ),
      });
    }

    void load();
    const timer = setInterval(() => void load(), 60000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  async function logout() {
    await createClient().auth.signOut();
    window.location.href = "/";
  }

  return (
    <>
      <button
        type="button"
        className={styles.adminMenuToggle}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        ☰ Menu
      </button>
      <aside className={styles.adminSidebar + (open ? " " + styles.adminSidebarOpen : "")}>
        <a href="/admin" className={styles.adminBrand}>
          <span>MIVO</span>
          <small>Seller Centre</small>
        </a>

        <nav className={styles.adminSideNav + " " + styles.adminSideNavGrouped}>
          <a href="/admin" className={isActive(pathname, "/admin") ? styles.active : ""}>
            Dashboard
          </a>
          {groups.map((group) => (
            <div className={styles.adminNavGroup} key={group.title}>
              <span className={styles.adminNavGroupTitle}>{group.title}</span>
              {group.items.map((item) => {
                const count = item.badge ? badges[item.badge] : 0;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={isActive(pathname, item.href) ? styles.active : ""}
                  >
                    {item.label}
                    {count ? <b className={styles.adminNavBadge}>{count > 99 ? "99+" : count}</b> : null}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={styles.adminMe}>
          <span className={styles.adminMeAvatar} aria-hidden="true">
            {me.avatar ? <img src={me.avatar} alt="" /> : (me.name || "A").slice(0, 1).toUpperCase()}
          </span>
          <span className={styles.adminMeText}>
            <strong>{me.name || "…"}</strong>
            <small>{me.email}</small>
          </span>
        </div>
        <div className={styles.adminMeLinks}>
          <a href="/" target="_blank" rel="noreferrer">
            View storefront ↗
          </a>
          <a href="/account">My profile</a>
          <button type="button" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
