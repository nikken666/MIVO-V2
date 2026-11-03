"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/admin/Admin.module.css";

type Badge = "toShip" | "chat" | "returns" | "notices" | "apps" | "claims";
type NavItem = { href: string; label: string; badge?: Badge; superadminOnly?: boolean };
type NavGroup = { title: string; items: NavItem[] };

// MIVO back office. Platform tools come first (what only MIVO can do), then
// MIVO Direct's own shop, then settings. Kept short on purpose: pages that
// are reached from another page (vouchers, discounts, fitment review, store
// health) aren't repeated here.
const platformGroup: NavGroup = {
  title: "Platform",
  items: [
    { href: "/admin/shops/applications", label: "Seller applications", badge: "apps" },
    { href: "/admin/shops", label: "Shops" },
    { href: "/admin/platform/campaigns", label: "Campaigns", superadminOnly: true },
    { href: "/admin/platform/free-shipping", label: "Free shipping", superadminOnly: true },
    { href: "/admin/platform/commission", label: "Commission", superadminOnly: true },
    { href: "/admin/platform/notices", label: "Notices to sellers", superadminOnly: true },
  ],
};

const groups: NavGroup[] = [
  {
    title: "Orders",
    items: [
      { href: "/admin/orders", label: "Orders", badge: "toShip" },
      { href: "/admin/arrange-shipment", label: "Arrange shipment" },
      { href: "/admin/returns", label: "Returns & refunds", badge: "returns" },
      { href: "/admin/claims", label: "Warranty claims", badge: "claims" },
      { href: "/admin/chat", label: "Chat", badge: "chat" },
    ],
  },
  {
    title: "MIVO Direct products",
    items: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/products/new", label: "Add product" },
      { href: "/admin/products/import", label: "Import from Shopee" },
      { href: "/admin/products/fitment-suggestions", label: "Vehicle fitment" },
      { href: "/admin/marketing", label: "Marketing" },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/admin/shipping", label: "Shipping & EasyParcel" },
      { href: "/admin/system-check", label: "System check" },
    ],
  },
];

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
    title: "Marketing",
    items: [
      { href: "/seller/marketing", label: "Marketing centre" },
      { href: "/seller/marketing?tab=vouchers", label: "Shop vouchers" },
      { href: "/seller/marketing?tab=campaigns", label: "MIVO campaigns" },
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
  const [badges, setBadges] = useState<Record<Badge, number>>({
    toShip: 0,
    chat: 0,
    returns: 0,
    notices: 0,
    apps: 0,
    claims: 0,
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

      const [{ data: profile }, toShip, chats, returns, superadmin, adminCheck, notices, apps, claims] = await Promise.all([
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
        supabase
          .from("seller_applications")
          .select("id", { count: "exact", head: true })
          .eq("status", "submitted")
          .then((r) => r, () => ({ count: 0 })),
        supabase
          .from("warranty_claims")
          .select("id", { count: "exact", head: true })
          .in("status", ["new", "reviewing"])
          .then((r) => r, () => ({ count: 0 })),
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
        apps: Number((apps as { count?: number | null }).count || 0),
        claims: Number((claims as { count?: number | null }).count || 0),
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

  const adminPlatform: NavGroup = {
    ...platformGroup,
    items: platformGroup.items.filter((item) => me.superadmin || !item.superadminOnly),
  };
  const navGroups = role === "seller" ? sellerGroups : role === "admin" ? [adminPlatform, ...groups] : [];
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
