# MIVO Real Order Checkout

This patch changes the temporary checkout message into actual order creation.

It creates:

- Parent order
- Seller orders
- Order item snapshots
- Commission calculation
- Inventory reservations
- MIVO order number
- Order confirmation page

Payment is not charged yet. The order remains `pending_payment`.

## Install

1. Run `supabase/create-pending-order.sql` in Supabase SQL Editor.
2. Upload this ZIP into the MIVO-V2 project root.
3. Run:

```bash
cd /workspaces/MIVO-V2
unzip -o mivo-v2-real-order-checkout.zip
rm mivo-v2-real-order-checkout.zip

rm -rf .next
npm run build
```

4. After a successful build:

```bash
git add -A
git commit -m "Create real checkout orders"
git push origin main
```
