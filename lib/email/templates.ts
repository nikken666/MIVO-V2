// Customer emails: one simple layout, three languages, every value escaped.

export type Lang = "en" | "ms" | "zh";

const words = {
  hi: { en: "Hi {name},", ms: "Hai {name},", zh: "{name}，你好：" },
  viewOrder: { en: "View my order", ms: "Lihat pesanan saya", zh: "查看订单" },
  orderNo: { en: "Order", ms: "Pesanan", zh: "订单" },
  subtotal: { en: "Subtotal", ms: "Jumlah kecil", zh: "商品小计" },
  shipping: { en: "Shipping", ms: "Penghantaran", zh: "运费" },
  discount: { en: "Discount", ms: "Diskaun", zh: "优惠" },
  total: { en: "Total paid", ms: "Jumlah dibayar", zh: "实付金额" },
  shipTo: { en: "Delivering to", ms: "Dihantar ke", zh: "收货地址" },
  qty: { en: "Qty", ms: "Kuantiti", zh: "数量" },
  help: {
    en: "Questions? Just reply to this email or chat with us on MIVO.",
    ms: "Ada soalan? Balas e-mel ini atau berbual dengan kami di MIVO.",
    zh: "有任何问题，直接回复这封邮件或在 MIVO 上联系我们。",
  },
  footer: {
    en: "You are receiving this because you have a MIVO account.",
    ms: "Anda menerima e-mel ini kerana anda mempunyai akaun MIVO.",
    zh: "你收到这封邮件是因为你注册了 MIVO 账号。",
  },
  unsubscribe: { en: "Unsubscribe from promotions", ms: "Berhenti terima promosi", zh: "退订促销邮件" },
  paidSubject: { en: "Order {no} confirmed – thank you!", ms: "Pesanan {no} disahkan – terima kasih!", zh: "订单 {no} 已确认，谢谢你的购买！" },
  paidTitle: { en: "Thanks for your order", ms: "Terima kasih atas pesanan anda", zh: "感谢你的订购" },
  paidText: {
    en: "We've received your payment. Here is your receipt. We'll email you again when your parcel ships.",
    ms: "Bayaran anda telah diterima. Ini resit anda. Kami akan e-mel lagi apabila bungkusan dihantar.",
    zh: "我们已收到你的付款，以下是你的收据。包裹发货时我们会再通知你。",
  },
  shippedSubject: { en: "Your parcel from {shop} is on the way ({no})", ms: "Bungkusan dari {shop} dalam perjalanan ({no})", zh: "{shop} 的包裹已发货（{no}）" },
  shippedTitle: { en: "Your parcel is on the way", ms: "Bungkusan anda dalam perjalanan", zh: "包裹已发出" },
  shippedText: {
    en: "{shop} has sent your parcel.",
    ms: "{shop} telah menghantar bungkusan anda.",
    zh: "{shop} 已经把你的包裹寄出。",
  },
  courier: { en: "Courier", ms: "Kurier", zh: "快递" },
  tracking: { en: "Tracking number", ms: "Nombor penjejakan", zh: "运单号" },
  track: { en: "Track my parcel", ms: "Jejak bungkusan", zh: "查看物流" },
  deliveredSubject: { en: "Delivered: your {shop} parcel ({no})", ms: "Telah dihantar: bungkusan {shop} ({no})", zh: "{shop} 的包裹已送达（{no}）" },
  deliveredTitle: { en: "Your parcel has arrived", ms: "Bungkusan anda telah tiba", zh: "包裹已送达" },
  deliveredText: {
    en: "Your parcel from {shop} was delivered. Everything OK? Confirm you received it and leave a review – it helps other drivers.",
    ms: "Bungkusan dari {shop} telah dihantar. Semuanya baik? Sahkan penerimaan dan tinggalkan ulasan – ia membantu pemandu lain.",
    zh: "{shop} 的包裹已送达。一切都好吗？确认收货并留下评价，可以帮助其他车主。",
  },
  review: { en: "Confirm & review", ms: "Sahkan & ulas", zh: "确认收货并评价" },
  cancelledSubject: { en: "Order {no} was cancelled", ms: "Pesanan {no} telah dibatalkan", zh: "订单 {no} 已取消" },
  cancelledTitle: { en: "Your order was cancelled", ms: "Pesanan anda telah dibatalkan", zh: "订单已取消" },
  cancelledText: {
    en: "Order {no} has been cancelled.",
    ms: "Pesanan {no} telah dibatalkan.",
    zh: "订单 {no} 已经取消。",
  },
  reason: { en: "Reason", ms: "Sebab", zh: "原因" },
  refundNote: {
    en: "Any money you paid is returned to your card. Banks usually take 5–10 working days to show it.",
    ms: "Wang yang dibayar dikembalikan ke kad anda. Bank biasanya mengambil 5–10 hari bekerja.",
    zh: "已付款项会退回你的银行卡，银行一般需要 5–10 个工作日入账。",
  },
  refundedSubject: { en: "Refund for order {no}", ms: "Bayaran balik untuk pesanan {no}", zh: "订单 {no} 退款通知" },
  refundedTitle: { en: "Your refund is on its way", ms: "Bayaran balik anda sedang diproses", zh: "退款已处理" },
  refundedText: {
    en: "We've refunded {amount} for order {no}.",
    ms: "Kami telah membayar balik {amount} untuk pesanan {no}.",
    zh: "订单 {no} 已退款 {amount}。",
  },
  promoFooter: {
    en: "You're receiving MIVO promotions because you said yes in your account.",
    ms: "Anda menerima promosi MIVO kerana anda bersetuju dalam akaun anda.",
    zh: "你收到 MIVO 促销邮件，是因为你在账号里选择了接收。",
  },
} satisfies Record<string, Record<Lang, string>>;

export function lang(value: unknown): Lang {
  return value === "ms" || value === "zh" ? value : "en";
}

function w(key: keyof typeof words, l: Lang, vars: Record<string, string> = {}) {
  return words[key][l].replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

export function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(value: unknown) {
  const url = String(value || "");
  return /^https?:\/\//i.test(url) ? url : "";
}

export function rm(value: unknown) {
  return "RM " + Number(value || 0).toFixed(2);
}

type Layout = {
  site: string;
  l: Lang;
  preheader: string;
  title: string;
  name?: string;
  bodyHtml: string;
  button?: { text: string; url: string };
  promo?: { unsubscribeUrl: string };
};

function layout(p: Layout) {
  const button = p.button && safeUrl(p.button.url)
    ? `<tr><td style="padding:8px 32px 28px"><a href="${esc(p.button.url)}" style="display:inline-block;padding:13px 26px;border-radius:999px;background:#0071e3;color:#ffffff;font-weight:600;font-size:15px;text-decoration:none">${esc(p.button.text)}</a></td></tr>`
    : "";
  const footer = p.promo
    ? `${esc(w("promoFooter", p.l))}<br><a href="${esc(p.promo.unsubscribeUrl)}" style="color:#6b7075">${esc(w("unsubscribe", p.l))}</a>`
    : esc(w("footer", p.l));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.title)}</title></head>
<body style="margin:0;padding:0;background:#f2f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'PingFang SC','Microsoft YaHei',sans-serif;color:#1d1d1f">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(p.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="padding:22px 32px 18px;border-top:5px solid #0071e3;border-bottom:1px solid #eef0f2"><img src="${esc(p.site)}/email-logo.png" alt="MIVO" width="134" height="30" style="display:block;width:134px;height:30px;border:0"></td></tr>
<tr><td style="padding:28px 32px 6px"><h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${esc(p.title)}</h1>
${p.name ? `<p style="margin:0 0 10px;font-size:15px">${esc(w("hi", p.l, { name: p.name }))}</p>` : ""}
${p.bodyHtml}</td></tr>
${button}
<tr><td style="padding:18px 32px 26px;border-top:1px solid #eef0f2;font-size:12px;line-height:1.6;color:#6b7075">${esc(w("help", p.l))}<br><br>${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function para(text: string) {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3d40">${esc(text)}</p>`;
}

function rows(list: Array<[string, string, boolean?]>) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;font-size:14px">${list
    .map(([k, v, bold]) => `<tr><td style="padding:5px 0;color:#6b7075">${esc(k)}</td><td align="right" style="padding:5px 0;${bold ? "font-weight:700;font-size:16px" : ""}">${esc(v)}</td></tr>`)
    .join("")}</table>`;
}

export type Item = { name: string; variant?: string | null; qty: number; total: number };

function itemsTable(items: Item[], l: Lang) {
  if (!items.length) return "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 10px;border-top:1px solid #eef0f2;font-size:14px">${items
    .map((item) => `<tr><td style="padding:10px 0;border-bottom:1px solid #eef0f2"><div style="font-weight:600">${esc(item.name)}</div>${item.variant ? `<div style="color:#6b7075;font-size:13px">${esc(item.variant)}</div>` : ""}<div style="color:#6b7075;font-size:13px">${esc(w("qty", l))}: ${esc(item.qty)}</div></td><td align="right" valign="top" style="padding:10px 0 10px 12px;border-bottom:1px solid #eef0f2;white-space:nowrap">${esc(rm(item.total))}</td></tr>`)
    .join("")}</table>`;
}

function addressText(address: Record<string, unknown> | null | undefined) {
  if (!address) return "";
  return [address.full_name, address.phone, address.address_line_1, address.address_line_2,
    [address.postcode, address.city].filter(Boolean).join(" "), address.state]
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .join("\n");
}

function textVersion(title: string, lines: string[], url?: string) {
  return [title, "", ...lines, url ? "\n" + url : ""].join("\n");
}

export type OrderInfo = {
  orderNumber: string;
  name: string;
  items: Item[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  address: Record<string, unknown> | null;
  reason?: string | null;
  refund?: number | null;
};

export function orderPaidEmail(site: string, l: Lang, o: OrderInfo) {
  const url = site + "/orders/" + encodeURIComponent(o.orderNumber);
  const address = addressText(o.address);
  const body =
    para(w("paidText", l)) +
    `<p style="margin:0 0 6px;font-size:13px;color:#6b7075">${esc(w("orderNo", l))} <b style="color:#1d1d1f">${esc(o.orderNumber)}</b></p>` +
    itemsTable(o.items, l) +
    rows([
      [w("subtotal", l), rm(o.subtotal)],
      [w("shipping", l), rm(o.shipping)],
      ...(o.discount > 0 ? [[w("discount", l), "− " + rm(o.discount)] as [string, string]] : []),
      [w("total", l), rm(o.total), true],
    ]) +
    (address
      ? `<p style="margin:0 0 4px;font-size:13px;color:#6b7075">${esc(w("shipTo", l))}</p><p style="margin:0 0 16px;font-size:14px;line-height:1.5;white-space:pre-line">${esc(address)}</p>`
      : "");
  return {
    subject: w("paidSubject", l, { no: o.orderNumber }),
    html: layout({ site, l, preheader: w("paidText", l), title: w("paidTitle", l), name: o.name, bodyHtml: body, button: { text: w("viewOrder", l), url } }),
    text: textVersion(w("paidTitle", l), [
      w("paidText", l),
      w("orderNo", l) + " " + o.orderNumber,
      ...o.items.map((i) => `- ${i.name}${i.variant ? " (" + i.variant + ")" : ""} x${i.qty}  ${rm(i.total)}`),
      w("total", l) + ": " + rm(o.total),
    ], url),
  };
}

export type ParcelInfo = {
  orderNumber: string;
  name: string;
  shop: string;
  courier?: string | null;
  tracking?: string | null;
  trackingUrl?: string | null;
  items: Item[];
};

export function parcelEmail(site: string, l: Lang, kind: "shipped" | "delivered", p: ParcelInfo) {
  const orderUrl = site + "/orders/" + encodeURIComponent(p.orderNumber);
  const shipped = kind === "shipped";
  const trackUrl = safeUrl(p.trackingUrl) || orderUrl;
  const title = w(shipped ? "shippedTitle" : "deliveredTitle", l);
  const text = w(shipped ? "shippedText" : "deliveredText", l, { shop: p.shop });
  const body =
    para(text) +
    (shipped && (p.courier || p.tracking)
      ? rows([
          ...(p.courier ? [[w("courier", l), p.courier] as [string, string]] : []),
          ...(p.tracking ? [[w("tracking", l), p.tracking, true] as [string, string, boolean]] : []),
        ])
      : "") +
    itemsTable(p.items, l);
  return {
    subject: w(shipped ? "shippedSubject" : "deliveredSubject", l, { no: p.orderNumber, shop: p.shop }),
    html: layout({
      site, l, preheader: text, title, name: p.name, bodyHtml: body,
      button: shipped ? { text: w("track", l), url: trackUrl } : { text: w("review", l), url: orderUrl },
    }),
    text: textVersion(title, [text, p.courier ? w("courier", l) + ": " + p.courier : "", p.tracking ? w("tracking", l) + ": " + p.tracking : ""].filter(Boolean), shipped ? trackUrl : orderUrl),
  };
}

export function cancelledEmail(site: string, l: Lang, o: OrderInfo) {
  const url = site + "/orders/" + encodeURIComponent(o.orderNumber);
  const text = w("cancelledText", l, { no: o.orderNumber });
  const body =
    para(text) +
    (o.reason ? rows([[w("reason", l), o.reason]]) : "") +
    para(w("refundNote", l));
  return {
    subject: w("cancelledSubject", l, { no: o.orderNumber }),
    html: layout({ site, l, preheader: text, title: w("cancelledTitle", l), name: o.name, bodyHtml: body, button: { text: w("viewOrder", l), url } }),
    text: textVersion(w("cancelledTitle", l), [text, o.reason ? w("reason", l) + ": " + o.reason : "", w("refundNote", l)].filter(Boolean), url),
  };
}

export function refundedEmail(site: string, l: Lang, o: OrderInfo) {
  const url = site + "/orders/" + encodeURIComponent(o.orderNumber);
  const text = w("refundedText", l, { no: o.orderNumber, amount: rm(o.refund ?? o.total) });
  return {
    subject: w("refundedSubject", l, { no: o.orderNumber }),
    html: layout({ site, l, preheader: text, title: w("refundedTitle", l), name: o.name, bodyHtml: para(text) + para(w("refundNote", l)), button: { text: w("viewOrder", l), url } }),
    text: textVersion(w("refundedTitle", l), [text, w("refundNote", l)], url),
  };
}

export type Campaign = {
  subject: string;
  headline?: string | null;
  body: string;
  image_url?: string | null;
  button_text?: string | null;
  button_url?: string | null;
};

export function campaignEmail(site: string, l: Lang, c: Campaign, name: string, unsubscribeUrl: string) {
  const image = safeUrl(c.image_url)
    ? `<img src="${esc(c.image_url)}" alt="" width="496" style="display:block;width:100%;max-width:496px;height:auto;margin:0 0 16px;border-radius:12px;border:0">`
    : "";
  const paragraphs = String(c.body || "").split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const body = image + paragraphs.map((block) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3a3d40;white-space:pre-line">${esc(block)}</p>`).join("");
  const button = c.button_text && safeUrl(c.button_url) ? { text: c.button_text, url: c.button_url! } : undefined;
  return {
    subject: c.subject,
    html: layout({ site, l, preheader: paragraphs[0] || c.subject, title: c.headline || c.subject, name, bodyHtml: body, button, promo: { unsubscribeUrl } }),
    text: textVersion(c.headline || c.subject, [...paragraphs, button ? button.text + ": " + button.url : "", "", w("unsubscribe", l) + ": " + unsubscribeUrl]),
    unsubscribeUrl,
  };
}
