"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/admin/Admin.module.css";

type Badge = "toShip" | "chat" | "returns" | "notices" | "apps" | "claims" | "preferred";
type NavItem = { href: string; label: string; badge?: Badge; superadminOnly?: boolean };
type NavGroup = { title: string; items: NavItem[] };

// MIVO back office, laid out like Shopee Seller Centre: the daily work first
// (orders, products), then marketing and chat, then platform tools and settings.
const platformGroup: NavGroup = {
  title: "Platform",
  items: [
    { href: "/admin/shops/applications", label: "Seller applications", badge: "apps" },
    { href: "/admin/shops", label: "Shops" },
    { href: "/admin/platform/preferred", label: "Preferred sellers", badge: "preferred", superadminOnly: true },
    { href: "/admin/platform/commission", label: "Commission", superadminOnly: true },
    { href: "/admin/platform/notices", label: "Notices to sellers", superadminOnly: true },
  ],
};

const groups: NavGroup[] = [
  {
    title: "Orders",
    items: [
      { href: "/admin/orders", label: "My orders", badge: "toShip" },
      { href: "/admin/arrange-shipment", label: "Mass ship & print labels" },
      { href: "/admin/returns", label: "Returns & refunds", badge: "returns" },
      { href: "/admin/claims", label: "Warranty claims", badge: "claims" },
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
      { href: "/admin/marketing", label: "Vouchers & discounts" },
      { href: "/admin/platform/campaigns", label: "Campaigns & banners", superadminOnly: true },
      { href: "/admin/platform/free-shipping", label: "Free shipping", superadminOnly: true },
      { href: "/admin/marketing/emails", label: "Customer emails" },
    ],
  },
  {
    title: "Customer service",
    items: [{ href: "/admin/chat", label: "Chat", badge: "chat" }],
  },
];

const settingsGroup: NavGroup = {
  title: "Settings",
  items: [
    { href: "/admin/shipping", label: "Shipping & EasyParcel" },
    { href: "/admin/system-check", label: "System check" },
  ],
};

// One small line icon per menu section (24×24, stroke).
const groupIcons: Record<string, string> = {
  Orders: "M4 7h16l-1.5 11a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7zM8 7a4 4 0 0 1 8 0",
  Products: "M4 8l8-4 8 4-8 4zM4 8v8l8 4 8-4V8M12 12v8",
  Marketing: "M4 10v4h3l6 4V6L7 10zM17 9a3 3 0 0 1 0 6",
  "Customer service": "M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  Platform: "M4 20h16M6 20V10M10 20V10M14 20V10M18 20V10M3 10l9-6 9 6",
  Settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14.3 3h-4l-.3 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.3 2.7h4l.3-2.7a7 7 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z",
  "Shop": "M4 9l1.5-5h13L20 9M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM9 20v-6h6v6",
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
    preferred: 0,
  });
  const [role, setRole] = useState<"admin" | "seller" | null>(null);
  const [open, setOpen] = useState(false);
  // Menu sections the user folded away (remembered on this device).
  const [folded, setFolded] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      setFolded(new Set(JSON.parse(window.localStorage.getItem("mivo:navFolded") || "[]") as string[]));
    } catch {
      // ignore
    }
  }, []);
  function toggleGroup(title: string) {
    setFolded((current) => {
      const next = new Set(current);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      try {
        window.localStorage.setItem("mivo:navFolded", JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }

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
      const isSuper = Boolean((superadmin as { data?: unknown }).data);
      const tierRequests = isSuper
        ? await supabase.rpc("platform_tier_requests").then((r) => r, () => ({ data: [] }))
        : { data: [] };
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
        preferred: (((tierRequests as { data?: unknown }).data as Array<{ status: string }> | null) || []).filter(
          (r) => r.status === "pending"
        ).length,
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

  const visible = (group: NavGroup): NavGroup => ({
    ...group,
    items: group.items.filter((item) => me.superadmin || !item.superadminOnly),
  });
  const navGroups =
    role === "seller"
      ? sellerGroups
      : role === "admin"
        ? [...groups, platformGroup, settingsGroup].map(visible).filter((group) => group.items.length)
        : [];
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
          {navGroups.map((group) => {
            const hasActive = group.items.some((item) => isActive(pathname, item.href, allHrefs));
            const isFolded = folded.has(group.title) && !hasActive;
            const groupCount = group.items.reduce((sum, item) => sum + (item.badge ? badges[item.badge] : 0), 0);
            return (
            <div className={styles.adminNavGroup} key={group.title}>
              <button
                type="button"
                className={styles.adminNavGroupTitle + " " + styles.adminNavGroupToggle}
                onClick={() => toggleGroup(group.title)}
                aria-expanded={!isFolded}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={groupIcons[group.title] || groupIcons.Products} />
                </svg>
                <span>{group.title}</span>
                {isFolded && groupCount ? <b className={styles.adminNavBadge}>{groupCount > 99 ? "99+" : groupCount}</b> : null}
                <i aria-hidden="true">{isFolded ? "▸" : "▾"}</i>
              </button>
              {isFolded ? null : group.items.map((item) => {
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
            );
          })}
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
