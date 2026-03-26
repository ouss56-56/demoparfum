-- FIX: Ensure the correct `create_order` function is deployed.
-- This version properly creates order_items rows AND deducts stock.
-- Run this in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION create_order(
    p_customer_id UUID,
    p_items JSONB,
    p_wilaya_name TEXT DEFAULT NULL,
    p_wilaya_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $func$
DECLARE
    v_order_id UUID := gen_random_uuid();
    v_total NUMERIC := 0;
    v_item JSONB;
    v_p_id UUID;
    v_qty NUMERIC;
    v_weight NUMERIC;
    v_reduction NUMERIC;
BEGIN
    -- 1. Create the Order Record
    INSERT INTO orders (id, customer_id, status, wilaya_name, wilaya_number, notes, "items")
    VALUES (v_order_id, p_customer_id, 'PENDING', p_wilaya_name, p_wilaya_number, p_notes, p_items);

    -- 2. Process Items, Deduct Stock, and Calculate Total
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_p_id := (v_item->>'productId')::UUID;
        v_qty := (v_item->>'quantity')::NUMERIC;
        v_weight := COALESCE((v_item->'volume'->>'weight')::NUMERIC, 0);
        v_reduction := v_qty * v_weight;

        -- Atomic Stock Deduction (only if weight > 0)
        IF v_reduction > 0 THEN
            UPDATE products 
            SET stock_weight = stock_weight - v_reduction,
                updated_at = NOW()
            WHERE id = v_p_id;

            IF NOT FOUND THEN 
                RAISE EXCEPTION 'Product % not found during order processing', v_p_id; 
            END IF;
        END IF;

        -- Insert into order_items normalization table
        INSERT INTO order_items (order_id, product_id, quantity, price, volume_data)
        VALUES (
            v_order_id, 
            v_p_id, 
            v_qty, 
            (v_item->>'price')::NUMERIC, 
            v_item->'volume'
        );

        -- Accumulate Total
        v_total := v_total + ((v_item->>'price')::NUMERIC * v_qty);
    END LOOP;

    -- 3. Update Order with final Total
    UPDATE orders SET total_price = v_total WHERE id = v_order_id;

    RETURN v_order_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
