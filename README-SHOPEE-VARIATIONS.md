# MIVO Complete Shopee-style Variations

This patch adds the full optional variation flow.

## Seller behavior

A seller can choose:

- No variation: one normal SKU.
- Variation 1 only: seller chooses the variation name and option values.
- Variation 1 + Variation 2: seller chooses both names and both option lists.

The system automatically generates every option combination.

Each combination has independent:

- SKU
- Selling price
- Original price
- Stock
- Weight
- Length
- Width
- Height
- Active / inactive state

A batch editor can apply common values to every combination.

## Buyer behavior

- Buyer selects the first variation.
- Buyer selects the second variation when it exists.
- Price, SKU and stock update according to the exact combination.
- Add to Cart remains disabled until selection is complete.
- Different combinations remain separate cart lines.

## Installation

### 1. Run the Supabase migration first

Open:

`supabase/shopee-style-product-variations.sql`

Copy all SQL into Supabase SQL Editor and run it.

### 2. Upload this patch into MIVO-V2

```bash
cd /workspaces/MIVO-V2
unzip -o mivo-v2-complete-shopee-variations.zip
rm mivo-v2-complete-shopee-variations.zip

rm -rf .next
npm run build
```

### 3. Publish

```bash
git add -A
git commit -m "Add complete Shopee style variations"
git push origin main
```
