"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../Admin.module.css";
import AdminSidebar from "@/components/admin/AdminSidebar";

type MarketingStats = {
  campaigns: number;
  upcomingCampaigns: number;
  vouchers: number;
  liveDiscounts: number;
  scheduledDiscounts: number;
};

export default function MarketingCentrePage() {
  const [stats, setStats] = useState<MarketingStats>({
    campaigns: 0,
    upcomingCampaigns: 0,
    vouchers: 0,
    liveDiscounts: 0,
    scheduledDiscounts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = "/login?next=/admin/marketing";
          return;
        }

        const { data: isAdmin, error: adminError } = await supabase.rpc(
          "is_admin"
        );

        if (adminError) throw adminError;
        if (!isAdmin) {
          window.location.href = "/";
          return;
        }

        const now = new Date().toISOString();
        const [
          { count: campaigns, error: campaignError },
          { count: upcomingCampaigns, error: upcomingCampaignError },
          { count: vouchers, error: voucherError },
          { count: liveDiscounts, error: liveError },
          { count: scheduledDiscounts, error: scheduledError },
        ] = await Promise.all([
          supabase
            .from("promotion_campaigns")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true)
            .lte("starts_at", now)
            .gte("ends_at", now),
          supabase
            .from("promotion_campaigns")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true)
            .gt("starts_at", now),
          supabase
            .from("vouchers")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true)
            .lte("starts_at", now)
            .gte("ends_at", now),
          supabase
            .from("product_variants")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true)
            .eq("discount_enabled", true)
            .lte("discount_starts_at", now)
            .gte("discount_ends_at", now),
          supabase
            .from("product_variants")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true)
            .eq("discount_enabled", true)
            .gt("discount_starts_at", now),
        ]);

        const firstError =
          campaignError ||
          upcomingCampaignError ||
          voucherError ||
          liveError ||
          scheduledError;
        if (firstError) throw firstError;

        if (!active) return;

        setStats({
          campaigns: campaigns || 0,
          upcomingCampaigns: upcomingCampaigns || 0,
          vouchers: vouchers || 0,
          liveDiscounts: liveDiscounts || 0,
          scheduledDiscounts: scheduledDiscounts || 0,
        });
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load Marketing Centre."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>
                MIVO · Growth & promotions
              </span>
              <h1>Marketing Centre</h1>
              <p>
                One place to manage homepage campaigns, vouchers and product
                discounts.
              </p>
            </div>
          </header>

          {error ? <p className={styles.adminError}>{error}</p> : null}

          <section className={styles.marketingHero}>
            <div>
              <span>Marketing centre</span>
              <h2>Plan campaigns like a marketplace.</h2>
              <p>
                Create traffic, convert with vouchers and push selected products
                using scheduled sale prices.
              </p>
            </div>
            <div className={styles.marketingHeroStats}>
              <article>
                <span>Active campaigns</span>
                <strong>{loading ? "—" : stats.campaigns}</strong>
              </article>
              <article>
                <span>Upcoming campaigns</span>
                <strong>{loading ? "—" : stats.upcomingCampaigns}</strong>
              </article>
              <article>
                <span>Active vouchers</span>
                <strong>{loading ? "—" : stats.vouchers}</strong>
              </article>
              <article>
                <span>Live discounts</span>
                <strong>{loading ? "—" : stats.liveDiscounts}</strong>
              </article>
            </div>
          </section>

          <section className={styles.marketingToolGrid}>
            <a
              href="/admin/marketing/campaigns"
              className={styles.marketingToolCard}
            >
              <div className={styles.marketingToolIcon}>01</div>
              <div>
                <span>Traffic</span>
                <h2>Campaigns</h2>
                <p>
                  Homepage banners, campaign artwork, colours, countdowns and
                  landing links.
                </p>
              </div>
              <footer>
                <span>
                  {loading ? "—" : stats.campaigns} active
                </span>
                <strong>Manage campaigns</strong>
              </footer>
            </a>

            <a
              href="/admin/marketing/vouchers"
              className={styles.marketingToolCard}
            >
              <div className={styles.marketingToolIcon}>02</div>
              <div>
                <span>Conversion</span>
                <h2>Vouchers</h2>
                <p>
                  Fixed discount, percentage and free-shipping vouchers with
                  minimum spend and product scopes.
                </p>
              </div>
              <footer>
                <span>{loading ? "—" : stats.vouchers} active</span>
                <strong>Manage vouchers</strong>
              </footer>
            </a>

            <a
              href="/admin/marketing/discounts"
              className={styles.marketingToolCard}
            >
              <div className={styles.marketingToolIcon}>03</div>
              <div>
                <span>Price campaign</span>
                <h2>Discounts</h2>
                <p>
                  Schedule sale prices by SKU and automatically restore regular
                  prices after the campaign.
                </p>
              </div>
              <footer>
                <span>
                  {loading ? "—" : stats.liveDiscounts} live ·{" "}
                  {loading ? "—" : stats.scheduledDiscounts} scheduled
                </span>
                <strong>Manage discounts</strong>
              </footer>
            </a>
          </section>

          <section className={styles.marketingGuide}>
            <span className={styles.adminPanelKicker}>Campaign flow</span>
            <div>
              <article>
                <b>1</b>
                <strong>Create traffic</strong>
                <small>Launch a homepage campaign banner.</small>
              </article>
              <i aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8h9M8 4l4 4-4 4"/></svg></i>
              <article>
                <b>2</b>
                <strong>Add incentive</strong>
                <small>Attach vouchers with clear conditions.</small>
              </article>
              <i aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3 8h9M8 4l4 4-4 4"/></svg></i>
              <article>
                <b>3</b>
                <strong>Push products</strong>
                <small>Run timed discounts on selected SKUs.</small>
              </article>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
