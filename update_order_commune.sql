-- ============================================================================
-- ADD COMMUNE TO CREATE_ORDER
-- ============================================================================

CREATE OR REPLACE FUNCTION create_order(
    p_customer_id UUID,
    p_items JSONB,
    p_wilaya_name TEXT DEFAULT NULL,
    p_wilaya_number TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_commune TEXT DEFAULT NULL
) RETURNS UUID AS $func$
DECLARE
    v_order_id UUID := gen_random_uuid();
    v_total NUMERIC := 0;
    v_item JSONB;
    v_p_id UUID;
    v_qty NUMERIC;
    v_weight NUMERIC;
    v_reduction NUMERIC;
    v_unit_price NUMERIC;
BEGIN
    INSERT INTO orders (id, customer_id, status, wilaya_name, wilaya_number, commune, notes, items, amount_paid, payment_status, logs, updated_at)
    VALUES (v_order_id, p_customer_id, 'PENDING', p_wilaya_name, p_wilaya_number, p_commune, p_notes, p_items, 0, 'UNPAID', '[]'::JSONB, NOW());

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_p_id := (v_item->>'productId')::UUID;
        v_qty := (v_item->>'quantity')::NUMERIC;
        v_unit_price := (v_item->>'price')::NUMERIC;
        v_weight := COALESCE((v_item->'volume'->>'weight')::NUMERIC, 0);
        v_reduction := v_qty * v_weight;

        IF v_reduction > 0 THEN
            UPDATE products 
            SET stock_weight = stock_weight - v_reduction,
                stock = stock - v_reduction,
                updated_at = NOW()
            WHERE id = v_p_id;
        END IF;

        INSERT INTO order_items (order_id, product_id, quantity, price, volume_id, volume_data)
        VALUES (
            v_order_id, v_p_id, v_qty, v_unit_price, 
            v_item->'volume'->>'id',
            v_item->'volume'
        );

        v_total := v_total + (v_unit_price * v_qty);
    END LOOP;

    UPDATE orders SET total_price = v_total, updated_at = NOW() WHERE id = v_order_id;
    RETURN v_order_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
