# MIVO Buyer / Seller flow patch

This patch changes the flow to:

- Registration creates a normal buyer account.
- Login goes to `/account`, not Seller Centre.
- Seller Centre is separate and optional at `/sellers`.
- Header shows `My Account` after login and a separate `Sell on MIVO` link.

## Install

Copy the `app` and `components` folders into the MIVO-V2 project root and replace matching files.

Then run:

```bash
rm -rf .next
npm run build
git add -A
git commit -m "Separate buyer and seller account flow"
git push origin main
```

## Current pending seller account

In Supabase Table Editor > sellers:

- Change `status` from `pending` to `approved` for a real MIVO seller account.
- Or delete only that seller row to keep the login as buyer-only.
- Do not delete the user from Authentication > Users.
