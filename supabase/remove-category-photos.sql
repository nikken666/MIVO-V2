-- =====================================================================
-- Removes the six old illustration photos (/categories/*.webp) from
-- products. Those files are no longer on the site. A product keeps its
-- own uploaded photos; one with no other photo shows the plain
-- placeholder until a real photo is added. Safe to re-run.
-- =====================================================================

begin;

delete from public.product_images
 where image_url ~ '^/categories/[a-z]+\.webp$';

update public.products p
   set primary_image_url = (
         select i.image_url from public.product_images i
          where i.product_id = p.id
          order by i.sort_order, i.image_url
          limit 1)
 where p.primary_image_url ~ '^/categories/[a-z]+\.webp$';

commit;
