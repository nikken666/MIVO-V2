-- =====================================================================
-- Liquids (engine oil, coolant, ATF / CVT / gear oil) can't be shipped to
-- Sabah, Sarawak or Labuan. Marks every matching product now, and new
-- products (e.g. Shopee imports) as they're added. Oil filters, coolers,
-- hoses, tanks and other parts are not matched. Safe to re-run.
-- To undo for one product: untick the states on its edit page.
-- =====================================================================

begin;

create or replace function public.mivo_is_liquid_product(p_name text)
returns boolean language sql immutable as $$
  select coalesce(p_name, '') ~* '(engine|motor|gear|gearbox|diesel|transmission)\s*oil|minyak\s*(hitam|enjin|engine|gear|gearbox|auto)|coolant|anti-?freeze|\matf\M|transmission\s*fluid|\mcvt\s*fluid|\m(0|5|10|15|20|75|80|85)w[- ]?\d{2}\M'
     and (coalesce(p_name, '') ~* '\d+(\.\d+)?\s*(l|lit(re|er)s?|ltrs?|ml)\M'
          or coalesce(p_name, '') ~* 'synthetic|mineral|fluid|minyak\s*(hitam|enjin|gear|gearbox|auto)|anti-?freeze|\matf\M|\m(0|5|10|15|20|75|80|85)w[- ]?\d{2}\M'
          or coalesce(p_name, '') !~* 'filter|seal|pump|sensor|hose|pipe|cooler|\mcap\M|tank|reservoir|\mpan\M|gasket|switch|dipstick|bottle|bracket|thermostat|valve|housing|radiator\s*(assy|core)|fan');
$$;

create temp table liquid_before on commit drop as
  select id from public.products
   where public.mivo_is_liquid_product(name)
     and restricted_shipping_states @> array['Sabah','Sarawak','W.P. Labuan'];

update public.products
   set restricted_shipping_states = (
         select array_agg(distinct s order by s)
           from unnest(coalesce(restricted_shipping_states, '{}') || array['Sabah','Sarawak','W.P. Labuan']) s),
       updated_at = now()
 where public.mivo_is_liquid_product(name)
   and not (coalesce(restricted_shipping_states, '{}') @> array['Sabah','Sarawak','W.P. Labuan']);

-- New products: same rule when they're added.
create or replace function public.mivo_products_liquid_rule()
returns trigger language plpgsql as $$
begin
  if public.mivo_is_liquid_product(new.name)
     and not (coalesce(new.restricted_shipping_states, '{}') @> array['Sabah','Sarawak','W.P. Labuan']) then
    new.restricted_shipping_states := (
      select array_agg(distinct s order by s)
        from unnest(coalesce(new.restricted_shipping_states, '{}') || array['Sabah','Sarawak','W.P. Labuan']) s);
  end if;
  return new;
end;
$$;
drop trigger if exists products_liquid_rule on public.products;
create trigger products_liquid_rule before insert on public.products
  for each row execute function public.mivo_products_liquid_rule();

create temp table liquid_summary on commit preserve rows as
  select s.shop_name as shop, count(*) as liquid_products,
         count(*) filter (where p.id not in (select id from liquid_before)) as newly_restricted
    from public.products p join public.sellers s on s.id = p.seller_id
   where public.mivo_is_liquid_product(p.name)
   group by s.shop_name order by s.shop_name;

commit;
select * from liquid_summary;
