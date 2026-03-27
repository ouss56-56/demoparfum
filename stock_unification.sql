-- ============================================================================
-- STOCK UNIFICATION AND RPC FIX
-- Run this in your Supabase SQL Editor to unify 'stock' and 'stock_weight'
-- and fix the order creation logic.
-- ============================================================================

-- 1. Ensure 'stock' and 'stock_weight' coexist and are synced
DO $$
BEGIN
    -- Ensure stock_weight exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'stock_weight') THEN
        ALTER TABLE products ADD COLUMN stock_weight NUMERIC DEFAULT 0;
    END IF;
    
    -- Ensure stock exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'stock') THEN
        ALTER TABLE products ADD COLUMN stock NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Sync values: Use the larger one if they differ (assuming one was updated and the other wasn't)
UPDATE products SET stock = GREATEST(stock, stock_weight);
UPDATE products SET stock_weight = stock;

-- 2. Update create_order RPC to update BOTH columns
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
    v_unit_price NUMERIC;
BEGIN
    INSERT INTO orders (id, customer_id, status, wilaya_name, wilaya_number, notes, items, amount_paid, payment_status, logs, updated_at)
    VALUES (v_order_id, p_customer_id, 'PENDING', p_wilaya_name, p_wilaya_number, p_notes, p_items, 0, 'UNPAID', '[]'::JSONB, NOW());

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

-- 3. Update adjust_stock RPC to update BOTH columns
CREATE OR REPLACE FUNCTION adjust_stock(
    p_product_id UUID, p_amount NUMERIC,
    p_reason TEXT DEFAULT 'Adjustment', p_source TEXT DEFAULT 'ADMIN'
) RETURNS NUMERIC SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new_stock NUMERIC;
BEGIN
    UPDATE products 
    SET stock_weight = stock_weight + p_amount,
        stock = stock + p_amount,
        updated_at = NOW()
    WHERE id = p_product_id
    RETURNING stock INTO v_new_stock;

    INSERT INTO inventory_logs (product_id, change_type, quantity, source, reason, created_at)
    VALUES (p_product_id, CASE WHEN p_amount >= 0 THEN 'RESTOCK' ELSE 'ADJUSTMENT' END, ABS(p_amount), p_source, p_reason, NOW());

    RETURN v_new_stock;
END;
$$ LANGUAGE plpgsql;

-- 4. Ensure RLS is fixed for 'postgres' user and admins
-- Enabling ALL access for better debugging in this demo stage
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Orders master access" ON orders;
CREATE POLICY "Orders master access" ON orders FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Products master access" ON products;
CREATE POLICY "Products master access" ON products FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notifications master access" ON notifications;
CREATE POLICY "Notifications master access" ON notifications FOR ALL USING (true) WITH CHECK (true);
