begin;

alter table public.products
  add column if not exists variation_1_name text,
  add column if not exists variation_2_name text;

alter table public.product_variants
  add column if not exists variation_1_value text,
  add column if not exists variation_2_value text;

comment on column public.products.variation_1_name is
  'Seller-defined first variation group name, for example Car Model, Colour, Size or Position.';

comment on column public.products.variation_2_name is
  'Optional seller-defined second variation group name.';

comment on column public.product_variants.variation_1_value is
  'Value selected from the first seller-defined variation group.';

comment on column public.product_variants.variation_2_value is
  'Value selected from the optional second seller-defined variation group.';

create index if not exists product_variants_product_option_values_idx
  on public.product_variants
  (product_id, variation_1_value, variation_2_value)
  where is_active = true;

commit;
