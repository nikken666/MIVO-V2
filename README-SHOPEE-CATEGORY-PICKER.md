# MIVO Shopee-style Category Picker

This patch replaces the long flat category dropdown with a cascading selector.

Seller flow:

1. Click `Choose category`.
2. Select `Vehicles' Spare Parts & Accessories`.
3. Select `Automobile Spare Parts`.
4. Select a section such as `Engine`, `Brakes`, or `Suspension and Steering`.
5. Select the final category such as `Oil Filters`, `Brake Pads`, or `Shock Absorbers`.
6. Click `Confirm`.

Only a final category can be confirmed.

## Install

Upload the ZIP into the MIVO-V2 project root and run:

```bash
cd /workspaces/MIVO-V2
unzip -o mivo-v2-shopee-category-picker-patch.zip
rm mivo-v2-shopee-category-picker-patch.zip

python3 apply-category-picker.py
rm apply-category-picker.py

rm -rf .next
npm run build
```

After a successful build:

```bash
git add -A
git commit -m "Add Shopee style category picker"
git push origin main
```
