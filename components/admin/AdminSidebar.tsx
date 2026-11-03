"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/admin/Admin.module.css";

type NavItem = { href: string; label: string; badge?: "toShip" | "chat" | "returns" | "notices" };
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
      { href: "/admin/products/fitment-review", label: "Fitment review" },
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
      { href: "/admin/shops/applications", label: "Seller applications" },
      { href: "/admin/shipping", label: "Shipping settings" },
      { href: "/admin/store-health", label: "Store health" },
      { href: "/admin/system-check", label: "System check" },
    ],
  },
];

// Superadmin-only platform tools.
const platformGroup: NavGroup = {
  title: "Platform",
  items: [
    { href: "/admin/platform/campaigns", label: "Platform campaigns" },
    { href: "/admin/platform/free-shipping", label: "Free shipping" },
    { href: "/admin/platform/commission", label: "Commission" },
    { href: "/admin/platform/notices", label: "Notices to sellers" },
  ],
};

// Sellers (shop owners who are not MIVO admins) see only their own shops.
const sellerGroups: NavGroup[] = [
  {
    title: "Orders",
    items: [
      { href: "/seller/orders", label: "My orders" },
      { href: "/seller/returns", label: "Returns & refunds", badge: "returns" },
    ],
  },
  {
    title: "Products",
    items: [
      { href: "/seller/products", label: "My products" },
      { href: "/admin/products/new", label: "Add new product" },
      { href: "/admin/products/import", label: "Import from Shopee" },
    ],
  },
  {
    title: "Customer service",
    items: [{ href: "/seller/chat", label: "Chat", badge: "chat" }],
  },
  {
    title: "Shop",
    items: [
      { href: "/seller/shop", label: "Shop settings" },
      { href: "/seller/notices", label: "MIVO notices", badge: "notices" },
    ],
  },
];

function isActive(pathname: string, href: string, all: string[]) {
  if (href === "/admin" || href === "/seller") return pathname === href;
  // The most specific matching link wins.
  const matches = all.filter((h) => pathname === h || pathname.startsWith(h + "/"));
  const best = matches.sort((a, b) => b.length - a.length)[0];
  return best === href;
}

/** Shared Seller Centre sidebar: grouped menu, live badges, signed-in admin. */
export default function AdminSidebar() {
  const pathname = usePathname() || "/admin";
  const [me, setMe] = useState<{ name: string; avatar: string | null; email: string; superadmin: boolean }>({
    name: "",
    avatar: null,
    email: "",
    superadmin: false,
  });
  const [badges, setBadges] = useState<{ toShip: number; chat: number; returns: number; notices: number }>({
    toShip: 0,
    chat: 0,
    returns: 0,
    notices: 0,
  });
  const [role, setRole] = useState<"admin" | "seller" | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !active) return;

      const [{ data: profile }, toShip, chats, returns, superadmin, adminCheck, notices] = await Promise.all([
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
        supabase.rpc("is_superadmin").then((r) => r, () => ({ data: false })),
        supabase.rpc("is_admin"),
        supabase.rpc("seller_unread_notices").then((r) => r, () => ({ data: 0 })),
      ]);
      if (!active) return;

      const p = (profile || {}) as { full_name?: string | null; avatar_url?: string | null };
      setMe({
        name: p.full_name?.trim() || user.email?.split("@")[0] || "Admin",
        avatar: p.avatar_url || null,
        email: user.email || "",
        superadmin: Boolean((superadmin as { data?: unknown }).data),
      });
      setRole(adminCheck.data ? "admin" : "seller");
      setBadges({
        notices: Number((notices as { data?: unknown }).data || 0),
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

  const navGroups =
    role === "seller" ? sellerGroups : me.superadmin ? [...groups, platformGroup] : role === "admin" ? groups : [];
  const home = role === "seller" ? "/seller" : "/admin";
  const allHrefs = navGroups.flatMap((g) => g.items.map((i) => i.href));

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
        <a href={role === "seller" ? "/seller" : "/admin"} className={styles.adminBrand}>
          <span>MIVO</span>
          <small>{role === "seller" ? "Seller Centre" : me.superadmin ? "Platform admin" : "Store control"}</small>
        </a>

        <nav className={styles.adminSideNav + " " + styles.adminSideNavGrouped}>
          <a href={home} className={isActive(pathname, home, allHrefs) ? styles.active : ""}>
            Dashboard
          </a>
          {navGroups.map((group) => (
            <div className={styles.adminNavGroup} key={group.title}>
              <span className={styles.adminNavGroupTitle}>{group.title}</span>
              {group.items.map((item) => {
                const count = item.badge ? badges[item.badge] : 0;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className={isActive(pathname, item.href, allHrefs) ? styles.active : ""}
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
            <strong>
              {me.name || "…"}
              {me.superadmin ? <span className={styles.adminMeRole}>SUPERADMIN</span> : null}
            </strong>
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
