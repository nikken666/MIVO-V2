# MIVO seller upload patch

This patch adds:

- Customer/seller registration and login
- Seller application
- Seller approval status page
- Product image upload to Supabase Storage
- Product, SKU, price, dimensions and stock insertion
- Seller product list
- Public catalogue reading active products from Supabase
- Product details and Add to Cart using real product images

## 1. Copy the patch

Copy these folders/files into the root of `MIVO-V2` and merge/replace when asked:

- `app`
- `components`
- `data`
- `lib`
- `middleware.ts`

Do not replace `public/mivo-logo.png` or `public/mivo-ip.png`.

## 2. Install Supabase packages

```bash
npm install @supabase/supabase-js @supabase/ssr
```

## 3. Environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_PROJECT_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Do not commit `.env.local`.

Add the same two variables in Vercel:

Project > Settings > Environment Variables

## 4. Storage policies

Run:

`supabase/product-images-storage-policies.sql`

inside Supabase SQL Editor.

A public bucket only makes downloads public. Uploads still need Storage RLS policies.

## 5. Register and apply as seller

Open:

`/login`

Register and confirm the email, then open:

`/sellers`

Submit the seller application.

## 6. Approve your first seller

In Supabase Table Editor:

- Open `sellers`
- Find your shop
- Change `status` from `pending` to `approved`
- Save

For the first MIVO-owned shop this manual approval is expected.
Later the MIVO admin dashboard will perform this action.

## 7. Upload a product

Open:

`/sellers/products/new`

The product will be created as `pending_review`.

To publish the first test product:

- Supabase Table Editor > `products`
- Change the product `status` to `active`
- Save

It will then appear on `/products`.

## 8. Build and deploy

```bash
npm run build
git add .
git commit -m "Add Supabase seller product upload"
git push origin main
```

Remember to configure the two Supabase environment variables in Vercel before testing the deployed website.
