"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  user_id: string;
};

type ShipmentInfo = {
  courier_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  status: string;
};

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

export default function TrackOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderNumber = String(searchParams.get("order") || "").trim();

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [shipment, setShipment] = useState<ShipmentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        if (!orderNumber) {
          router.replace("/orders");
          return;
        }

        const supabase = createClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace(
            "/login?next=" +
              encodeURIComponent("/track-order?order=" + orderNumber)
          );
          return;
        }

        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("id, order_number, status, user_id")
          .eq("order_number", orderNumber)
          .eq("user_id", user.id)
          .maybeSingle();

        if (orderError || !orderData) {
          throw orderError || new Error("Order not found.");
        }

        const { data: sellerOrder, error: sellerOrderError } = await supabase
          .from("seller_orders")
          .select("id")
          .eq("order_id", orderData.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (sellerOrderError) throw sellerOrderError;

        let shipmentData: ShipmentInfo | null = null;

        if (sellerOrder?.id) {
          const { data: foundShipment, error: shipmentError } = await supabase
            .from("shipments")
            .select("courier_name, tracking_number, tracking_url, status")
            .eq("seller_order_id", sellerOrder.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (shipmentError) throw shipmentError;
          shipmentData = (foundShipment as ShipmentInfo | null) || null;
        }

        if (!active) return;

        setOrder(orderData as OrderRow);
        setShipment(shipmentData);
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load shipment tracking."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [orderNumber, router]);

  async function copyTracking() {
    if (!shipment?.tracking_number) return;

    try {
      await navigator.clipboard.writeText(shipment.tracking_number);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  if (loading) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <p className="accountDataNotice">Loading tracking...</p>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <div className="ordersEmpty">
            <strong>Unable to open tracking.</strong>
            <p>{error || "Order not found."}</p>
            <Link href="/orders">BACK TO MY ORDERS →</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="accountDataPage">
      <div
        className="container"
        style={{
          minHeight: "70vh",
          display: "grid",
          placeItems: "center",
          paddingTop: 46,
          paddingBottom: 64,
        }}
      >
        <section
          style={{
            width: "min(680px, 100%)",
            border: "1px solid #e5e7e8",
            borderRadius: 22,
            background: "#fff",
            padding: "34px",
            boxShadow: "0 18px 60px rgba(0,0,0,.05)",
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: ".14em",
              color: "#7b8286",
              marginBottom: 8,
            }}
          >
            MIVO SHIPMENT TRACKING
          </span>

          <h1 style={{ margin: 0, fontSize: 36, letterSpacing: "-.04em" }}>
            Track Parcel
          </h1>

          <p style={{ margin: "10px 0 28px", color: "#73797d" }}>
            Your courier and tracking number are filled in automatically.
          </p>

          <div
            style={{
              display: "grid",
              gap: 14,
              padding: 20,
              borderRadius: 14,
              background: "#f7f8f8",
            }}
          >
            <div>
              <span style={{ display: "block", fontSize: 10, color: "#8a9094" }}>
                ORDER
              </span>
              <strong>{order.order_number}</strong>
            </div>

            <div>
              <span style={{ display: "block", fontSize: 10, color: "#8a9094" }}>
                COURIER
              </span>
              <strong>{shipment?.courier_name || "—"}</strong>
            </div>

            <div>
              <span style={{ display: "block", fontSize: 10, color: "#8a9094" }}>
                TRACKING NUMBER
              </span>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 10,
                  marginTop: 6,
                }}
              >
                <input
                  readOnly
                  value={shipment?.tracking_number || ""}
                  placeholder="Tracking number not available yet"
                  style={{
                    minWidth: 0,
                    minHeight: 44,
                    padding: "0 12px",
                    border: "1px solid #d8dcde",
                    borderRadius: 9,
                    background: "#fff",
                    fontWeight: 700,
                  }}
                />
                <button
                  type="button"
                  className="orderGhostButton"
                  disabled={!shipment?.tracking_number}
                  onClick={() => void copyTracking()}
                  style={{ minWidth: 100 }}
                >
                  {copied ? "COPIED" : "COPY"}
                </button>
              </div>
            </div>

            <div>
              <span style={{ display: "block", fontSize: 10, color: "#8a9094" }}>
                STATUS
              </span>
              <strong>
                {shipment?.status
                  ? statusLabel(shipment.status)
                  : statusLabel(order.status)}
              </strong>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginTop: 20,
            }}
          >
            {shipment?.tracking_url && shipment?.tracking_number ? (
              <a
                href={shipment.tracking_url}
                target="_blank"
                rel="noreferrer"
                className="orderPrimaryButton"
              >
                OPEN COURIER TRACKING
              </a>
            ) : (
              <button className="orderPrimaryButton" disabled>
                TRACKING NOT READY
              </button>
            )}

            <Link
              href={"/orders/" + encodeURIComponent(order.order_number)}
              className="orderGhostButton"
            >
              BACK TO ORDER
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
