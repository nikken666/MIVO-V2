begin;

create or replace function public.create_pending_order(
  p_items jsonb,
  p_shipping_address jsonb,
  p_customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_order public.orders%rowtype;
  v_item jsonb;
  v_variant public.product_variants%rowtype;
  v_product public.products%rowtype;
  v_seller public.sellers%rowtype;
  v_seller_order public.seller_orders%rowtype;
  v_variant_id uuid;
  v_quantity integer;
  v_line_subtotal numeric(12,2);
  v_commission_rate numeric(5,2);
  v_commission_amount numeric(12,2);
  v_seller_net numeric(12,2);
  v_subtotal numeric(12,2) := 0;
begin
  if v_user_id is null then
    raise exception 'You must be logged in to checkout';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty';
  end if;

  if coalesce(btrim(p_shipping_address ->> 'full_name'), '') = ''
     or coalesce(btrim(p_shipping_address ->> 'phone'), '') = ''
     or coalesce(btrim(p_shipping_address ->> 'address_line_1'), '') = ''
     or coalesce(btrim(p_shipping_address ->> 'city'), '') = ''
     or coalesce(btrim(p_shipping_address ->> 'state'), '') = ''
     or coalesce(btrim(p_shipping_address ->> 'postcode'), '') = '' then
    raise exception 'Complete all required shipping fields';
  end if;

  insert into public.orders (
    user_id,
    status,
    payment_status,
    currency,
    subtotal,
    shipping_amount,
    discount_amount,
    tax_amount,
    total_amount,
    shipping_address,
    customer_note
  )
  values (
    v_user_id,
    'pending_payment',
    'pending',
    'MYR',
    0,
    0,
    0,
    0,
    0,
    p_shipping_address,
    nullif(btrim(p_customer_note), '')
  )
  returning * into v_order;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    begin
      v_variant_id := (v_item ->> 'variant_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'Invalid cart item';
    end;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'Item quantity must be greater than zero';
    end if;

    select pv.*
    into v_variant
    from public.product_variants pv
    where pv.id = v_variant_id
      and pv.is_active = true
    for update;

    if not found then
      raise exception 'A selected product variation is unavailable';
    end if;

    select p.*
    into v_product
    from public.products p
    where p.id = v_variant.product_id
      and p.status = 'active';

    if not found then
      raise exception 'A selected product is no longer active';
    end if;

    select s.*
    into v_seller
    from public.sellers s
    where s.id = v_variant.seller_id
      and s.status = 'approved';

    if not found then
      raise exception 'The seller for SKU % is unavailable', v_variant.sku;
    end if;

    if (v_variant.stock_on_hand - v_variant.stock_reserved) < v_quantity then
      raise exception 'Insufficient stock for SKU %', v_variant.sku;
    end if;

    v_line_subtotal := round(v_variant.price * v_quantity, 2);
    v_commission_rate := v_seller.commission_rate;
    v_commission_amount := round(
      v_line_subtotal * v_commission_rate / 100,
      2
    );
    v_seller_net := v_line_subtotal - v_commission_amount;
    v_subtotal := v_subtotal + v_line_subtotal;

    select so.*
    into v_seller_order
    from public.seller_orders so
    where so.order_id = v_order.id
      and so.seller_id = v_seller.id;

    if not found then
      insert into public.seller_orders (
        order_id,
        order_number,
        customer_id,
        seller_id,
        status,
        subtotal,
        shipping_amount,
        commission_amount,
        seller_net_amount,
        shipping_address,
        customer_note
      )
      values (
        v_order.id,
        v_order.order_number,
        v_user_id,
        v_seller.id,
        'pending_payment',
        0,
        0,
        0,
        0,
        p_shipping_address,
        nullif(btrim(p_customer_note), '')
      )
      returning * into v_seller_order;
    end if;

    insert into public.order_items (
      order_id,
      seller_order_id,
      seller_id,
      product_id,
      variant_id,
      product_name,
      variant_name,
      sku,
      unit_price,
      quantity,
      line_subtotal,
      commission_rate,
      commission_amount,
      seller_net_amount
    )
    values (
      v_order.id,
      v_seller_order.id,
      v_seller.id,
      v_product.id,
      v_variant.id,
      v_product.name,
      nullif(v_variant.title, 'Default'),
      v_variant.sku,
      v_variant.price,
      v_quantity,
      v_line_subtotal,
      v_commission_rate,
      v_commission_amount,
      v_seller_net
    );

    update public.seller_orders
    set
      subtotal = subtotal + v_line_subtotal,
      commission_amount = commission_amount + v_commission_amount,
      seller_net_amount = seller_net_amount + v_seller_net
    where id = v_seller_order.id;

    perform public.reserve_inventory(
      v_variant.id,
      v_quantity,
      v_order.id,
      'Checkout reservation'
    );
  end loop;

  update public.orders
  set
    subtotal = v_subtotal,
    total_amount = v_subtotal
  where id = v_order.id
  returning * into v_order;

  insert into public.order_status_history (
    order_id,
    old_status,
    new_status,
    note,
    changed_by
  )
  values (
    v_order.id,
    null,
    'pending_payment',
    'Order created at checkout',
    v_user_id
  );

  return jsonb_build_object(
    'id', v_order.id,
    'order_number', v_order.order_number,
    'status', v_order.status,
    'payment_status', v_order.payment_status,
    'subtotal', v_order.subtotal,
    'total_amount', v_order.total_amount,
    'currency', v_order.currency
  );
end;
$$;

revoke all on function public.create_pending_order(jsonb, jsonb, text)
from public, anon;

grant execute on function public.create_pending_order(jsonb, jsonb, text)
to authenticated;

commit;

notify pgrst, 'reload schema';
