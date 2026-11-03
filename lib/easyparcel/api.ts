import { getEasyParcelToken, refreshEasyParcelToken } from "@/lib/easyparcel/oauth";

// EasyParcel Open API (https://easyparcel.github.io/OpenAPI), version in the path.
// Sandbox and live share one host; the connected account decides which one.
const VERSION = process.env.EASYPARCEL_API_VERSION || "2026-06";

function base() {
  return (process.env.EASYPARCEL_API_BASE || "https://api.easyparcel.com").replace(/\/$/, "") + "/open_api/" + VERSION;
}

export class EasyParcelError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

type Envelope<T> = { status_code?: number; message?: string; data?: T; errors?: Array<{ message?: string }> };

async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}, retried = false): Promise<T> {
  const token = await getEasyParcelToken();
  const response = await fetch(base() + path, {
    method: init.method || "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as Envelope<T>;
  if (response.status === 401 && !retried) {
    await refreshEasyParcelToken();
    return call<T>(path, init, true);
  }
  if (response.status === 422) {
    throw new EasyParcelError("MIVO's EasyParcel wallet doesn't have enough credit. Top it up in EasyParcel, then try again.", 422);
  }
  if (response.status === 429) {
    throw new EasyParcelError("EasyParcel is busy (rate limit). Please try again in a minute.", 429);
  }
  if (!response.ok) {
    const detail =
      data.message ||
      (data.data && typeof data.data === "object" && "errors" in (data.data as object)
        ? ((data.data as { errors?: string[] }).errors || []).join("; ")
        : "") ||
      "HTTP " + response.status;
    throw new EasyParcelError("EasyParcel: " + detail, response.status);
  }
  return data.data as T;
}

// ---- Addresses -------------------------------------------------------

const STATE_CODES: Array<[RegExp, string]> = [
  [/johor/, "MY-01"],
  [/kedah/, "MY-02"],
  [/kelantan/, "MY-03"],
  [/melaka|malacca/, "MY-04"],
  [/negeri/, "MY-05"],
  [/pahang/, "MY-06"],
  [/pinang|penang/, "MY-07"],
  [/perak/, "MY-08"],
  [/perlis/, "MY-09"],
  [/selangor/, "MY-10"],
  [/terengganu/, "MY-11"],
  [/sabah/, "MY-12"],
  [/sarawak/, "MY-13"],
  [/kuala lumpur/, "MY-14"],
  [/labuan/, "MY-15"],
  [/putrajaya/, "MY-16"],
];

export function stateCode(state: string | null | undefined) {
  const value = (state || "").toLowerCase();
  return STATE_CODES.find(([pattern]) => pattern.test(value))?.[1] || "";
}

/** EasyParcel wants national digits without the leading 0 (e.g. 0123456789 → 123456789). */
export function phoneDigits(phone: string | null | undefined) {
  let digits = (phone || "").replace(/\D/g, "");
  if (digits.startsWith("60")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

export type Address = {
  name: string;
  phone: string;
  email?: string | null;
  line1: string;
  line2?: string | null;
  postcode: string;
  city: string;
  state: string;
};

function party(address: Address) {
  return {
    name: address.name,
    phone_number_country_code: "MY",
    phone_number: phoneDigits(address.phone),
    email: address.email || undefined,
    address_1: address.line1,
    address_2: address.line2 || undefined,
    postcode: address.postcode,
    city: address.city,
    subdivision_code: stateCode(address.state),
    country_code: "MY",
  };
}

// ---- Quotation ---------------------------------------------------------

export type Parcel = { weight: number; length: number; width: number; height: number; value: number; content: string };

export type Quote = {
  serviceId: string;
  serviceName: string;
  courierId: string;
  courierName: string;
  isPickup: boolean;
  isDropoff: boolean;
  price: number;
};

type RawQuote = {
  courier: {
    service_id: string;
    service_name: string;
    courier_id: string;
    courier_name: string;
    is_pickup?: boolean;
    is_dropoff?: boolean;
  };
  pricing: { total_amount: number | string; seller_payable_amount?: number | string };
};

export async function quote(sender: Address, receiver: Address, parcel: Parcel): Promise<Quote[]> {
  const data = await call<Array<{ status: string; errors?: string[]; quotations?: RawQuote[] }>>("/shipment/quotations", {
    body: {
      api_rate_on: false,
      auto_apply_coupon: false,
      shipment: [
        {
          sender: { postcode: sender.postcode, subdivision_code: stateCode(sender.state), country: "MY" },
          receiver: { postcode: receiver.postcode, subdivision_code: stateCode(receiver.state), country: "MY" },
          weight: parcel.weight,
          length: parcel.length,
          width: parcel.width,
          height: parcel.height,
          parcel_value: parcel.value,
        },
      ],
    },
  });
  const first = data?.[0];
  if (!first || first.status !== "success") {
    throw new EasyParcelError("EasyParcel couldn't quote this parcel: " + (first?.errors || ["no rates"]).join("; ").trim(), 400);
  }
  return (first.quotations || [])
    .map((q) => ({
      serviceId: q.courier.service_id,
      serviceName: q.courier.service_name,
      courierId: q.courier.courier_id,
      courierName: q.courier.courier_name,
      isPickup: Boolean(q.courier.is_pickup) || /pick ?up/i.test(q.courier.service_name),
      isDropoff: Boolean(q.courier.is_dropoff) || /drop/i.test(q.courier.service_name),
      price: Number(q.pricing.seller_payable_amount ?? q.pricing.total_amount),
    }))
    .filter((q) => Number.isFinite(q.price))
    .sort((a, b) => a.price - b.price);
}

/** Cheapest service for the method; skips pickup services that need several parcels. */
export function pickService(quotes: Quote[], method: "pickup" | "dropoff") {
  const usable = quotes.filter((q) =>
    method === "pickup" ? q.isPickup && !/min\s*\d+\s*parcel/i.test(q.serviceName) : q.isDropoff
  );
  return usable[0] || null;
}

// ---- Booking -------------------------------------------------------------

export type Booking = {
  orderNumber: string | null;
  shipmentNumber: string;
  courier: string;
  awbNumber: string | null;
  awbUrl: string | null;
  labelUrls: Record<string, string>;
  trackingUrl: string | null;
  paid: number | null;
};

type RawShipment = {
  status: string;
  errors?: string[];
  shipment_number?: string;
  courier?: string;
  awb_number?: string | null;
  awb_url?: string | null;
  awb_urls_by_format?: Record<string, string>;
  tracking_url?: string | null;
  pricing_breakdown?: { total_paid_amount?: string | number };
};

/**
 * Books and pays one shipment from MIVO's EasyParcel wallet.
 * One shipment per request so a failure maps to its parcel. Never retried
 * automatically: EasyParcel has no idempotency key.
 */
export async function submit(input: {
  reference: string;
  serviceId: string;
  collectionDate: string;
  sender: Address;
  receiver: Address;
  parcel: Parcel;
}): Promise<Booking> {
  const data = await call<Array<{ order_details?: { order_number?: string }; shipments?: RawShipment[] }>>(
    "/shipment/submit_orders",
    {
      body: {
        auto_apply_coupon: false,
        shipment: [
          {
            reference: input.reference,
            service_id: input.serviceId,
            collection_date: input.collectionDate,
            weight: input.parcel.weight,
            length: input.parcel.length,
            width: input.parcel.width,
            height: input.parcel.height,
            item: [
              {
                content: input.parcel.content.slice(0, 100),
                weight: input.parcel.weight,
                length: input.parcel.length,
                width: input.parcel.width,
                height: input.parcel.height,
                currency_code: "MYR",
                value: input.parcel.value,
                quantity: 1,
              },
            ],
            sender: party(input.sender),
            receiver: party(input.receiver),
            feature: { sms_tracking: false, email_tracking: false, whatsapp_tracking: false },
          },
        ],
      },
    }
  );
  const order = data?.[0];
  const shipment = order?.shipments?.[0];
  if (!shipment || shipment.status !== "success" || !shipment.shipment_number) {
    throw new EasyParcelError("EasyParcel didn't book it: " + (shipment?.errors || ["unknown error"]).join("; ").trim(), 400);
  }
  const labels = shipment.awb_urls_by_format || {};
  return {
    orderNumber: order?.order_details?.order_number || null,
    shipmentNumber: shipment.shipment_number,
    courier: shipment.courier || "",
    awbNumber: shipment.awb_number || null,
    awbUrl: shipment.awb_url || labels.A6 || labels.A4 || null,
    labelUrls: Object.fromEntries(Object.entries(labels).filter(([, url]) => Boolean(url))),
    trackingUrl: shipment.tracking_url || null,
    paid: shipment.pricing_breakdown?.total_paid_amount != null ? Number(shipment.pricing_breakdown.total_paid_amount) : null,
  };
}

// ---- Details, tracking, cancel --------------------------------------------

export async function details(shipmentNumber: string) {
  const data = await call<
    Array<{
      shipment_details?: {
        awb_number?: string | null;
        awb_url?: string | null;
        tracking_url?: string | null;
        shipment_status_code?: number;
        shipment_status?: string;
      };
      courier?: { courier_name?: string };
    }>
  >("/shipment/details", { body: { shipment_number: shipmentNumber } });
  const row = data?.[0];
  return {
    awbNumber: row?.shipment_details?.awb_number || null,
    awbUrl: row?.shipment_details?.awb_url || null,
    trackingUrl: row?.shipment_details?.tracking_url || null,
    statusCode: row?.shipment_details?.shipment_status_code ?? null,
    status: row?.shipment_details?.shipment_status || null,
    courier: row?.courier?.courier_name || null,
  };
}

export type TrackingEvent = { time: string; code: number | null; description: string; location: string | null };

/** "2026-01-23 12:29:47" is Malaysia time; ISO strings carry their own zone. */
function parseTime(value: string) {
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(value)) return new Date(value).toISOString();
  return new Date(value.replace(" ", "T") + "+08:00").toISOString();
}

export async function tracking(awbNumbers: string[]) {
  const data = await call<{
    results?: Array<{
      status: string;
      awb_number: string;
      latest_shipment_status_code?: number;
      latest_tracking_status?: string;
      status_log?:
        | Array<{ event_date?: string; timestamp?: string; shipment_status_code?: number; tracking_status: string; location?: string }>
        | Record<string, { event_date?: string; timestamp?: string; shipment_status_code?: number; tracking_status: string; location?: string }>;
    }>;
  }>("/shipment/tracking_status", { body: { awb_numbers: awbNumbers.slice(0, 100) } });
  return (data?.results || [])
    .filter((row) => row.status === "success")
    .map((row) => {
      const log = Array.isArray(row.status_log) ? row.status_log : Object.values(row.status_log || {});
      const events: TrackingEvent[] = log
        .map((e) => ({
          time: parseTime(e.event_date || e.timestamp || new Date().toISOString()),
          code: e.shipment_status_code ?? null,
          description: (e.tracking_status || "").trim(),
          location: e.location || null,
        }))
        .filter((e) => e.description)
        .sort((a, b) => a.time.localeCompare(b.time));
      return {
        awbNumber: row.awb_number,
        statusCode: row.latest_shipment_status_code ?? null,
        status: row.latest_tracking_status || null,
        events,
      };
    });
}

export async function cancel(shipmentNumber: string, remark: string) {
  const data = await call<Array<{ status: string; message?: string }>>("/shipment/cancel", {
    body: { cancel_list: [{ shipment_number: shipmentNumber, remark }] },
  });
  const row = data?.[0];
  if (!row || row.status !== "success") throw new EasyParcelError("EasyParcel: " + (row?.message || "could not cancel"), 400);
}

export async function wallet() {
  const data = await call<{ wallet?: Array<{ balance: number; currency: string }> }>("/wallet", { method: "GET" });
  return Number(data?.wallet?.[0]?.balance ?? 0);
}
