// A signed-in user who isn't a MIVO admin opened an /admin page.
// Sellers belong in Seller Centre, so send them to the matching page there
// (Seller Centre itself sends shoppers without a shop to /sell).
const sellerPage: Record<string, string> = {
  "/admin/orders": "/seller/orders",
  "/admin/arrange-shipment": "/seller/orders",
  "/admin/products": "/seller/products",
  "/admin/returns": "/seller/returns",
  "/admin/chat": "/seller/chat",
  "/admin/shops": "/seller/shop",
};

export function leaveBackOffice() {
  const path = window.location.pathname.replace(/\/$/, "");
  window.location.href = sellerPage[path] || "/seller";
}
