-- Consolidated Initial Schema for Perfume Demo Platform

-- 1. BASE TABLES
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    brand TEXT,
    brand_id UUID,
    description TEXT,
    category_id UUID,
    image_url TEXT,
    images JSONB DEFAULT '[]',
    volumes JSONB DEFAULT '[]',
    base_price NUMERIC DEFAULT 0,
    purchase_price NUMERIC DEFAULT 0,
    stock_weight NUMERIC DEFAULT 0,
    low_stock_threshold NUMERIC DEFAULT 500,
    status TEXT DEFAULT 'ACTIVE',
    tag_ids UUID[] DEFAULT '{}',
    collection_ids UUID[] DEFAULT '{}',
    sales_units_sold NUMERIC DEFAULT 0,
    sales_revenue NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    phone TEXT UNIQUE NOT NULL,
    shop_name TEXT,
    wilaya TEXT,
    wilaya_id INTEGER,
    commune TEXT,
    address TEXT,
    role TEXT DEFAULT 'TRADER',
    password_hash TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers(id),
    status TEXT DEFAULT 'PENDING',
    total_price NUMERIC DEFAULT 0,
    items JSONB DEFAULT '[]',
    invoice JSONB,
    wilaya_number TEXT,
    wilaya_name TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity NUMERIC NOT NULL,
    price NUMERIC,
    volume_data JSONB
);

CREATE TABLE IF NOT EXISTS inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    source TEXT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    change_amount NUMERIC NOT NULL,
    resulting_stock NUMERIC NOT NULL,
    source TEXT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'INFO',
    is_read BOOLEAN DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
    id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000',
    whatsapp_number TEXT NOT NULL DEFAULT '+213000000000',
    facebook_page TEXT NOT NULL DEFAULT 'demo_platform',
    contact_email TEXT DEFAULT 'contact@demo-perfume.com',
    store_address TEXT DEFAULT 'Algeria',
    logo_url TEXT DEFAULT '/logo.png',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    entity_id TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ADMINS TABLE
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'ADMIN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. INSERT INITIAL DATA
INSERT INTO site_settings (id, whatsapp_number, facebook_page, contact_email, store_address, logo_url)
VALUES ('00000000-0000-0000-0000-000000000000', '+213542303496', 'demo_luxe', 'admin@demo-luxe.com', 'Algeria, Demo Luxe District', '/logo.png')
ON CONFLICT (id) DO NOTHING;

-- Insert Admin (Password: 123456)
INSERT INTO admins (email, password_hash, name, role)
VALUES ('admin@gmail.com', '$2b$10$MMKnR5w34mp0DyMlEGJ0mOtxfHfaZzDLJ3v2KEOqtkg8KQtV.LR6i', 'Super Admin', 'SUPER_ADMIN')
ON CONFLICT (email) DO NOTHING;

-- 4. FUNCTIONS AND TRIGGERS

-- Detailed Atomic Stock Adjustment (Manual/Internal)
CREATE OR REPLACE FUNCTION adjust_stock(
    p_product_id UUID, 
    p_amount NUMERIC, 
    p_reason TEXT, 
    p_source TEXT DEFAULT 'MANUAL_ADJUSTMENT'
)
RETURNS VOID AS $$
DECLARE
    v_current_stock NUMERIC;
    v_new_stock NUMERIC;
BEGIN
    -- Use FOR UPDATE to lock the row during transaction
    SELECT stock INTO v_current_stock FROM products WHERE id = p_product_id FOR UPDATE;
    
    IF v_current_stock IS NULL THEN 
        RAISE EXCEPTION 'Product with ID % not found', p_product_id; 
    END IF;
    
    v_new_stock := v_current_stock + p_amount;
    
    UPDATE products 
    SET stock = v_new_stock,
        updated_at = NOW()
    WHERE id = p_product_id;
    
    INSERT INTO inventory_history (product_id, type, change_amount, resulting_stock, source, reason)
    VALUES (
        p_product_id, 
        CASE WHEN p_amount >= 0 THEN 'RESTOCK' ELSE 'ADJUSTMENT' END, 
        p_amount, 
        v_new_stock, 
        p_source, 
        p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Master Atomic Order Creation RPC
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
        v_weight := (v_item->'volume'->>'weight')::NUMERIC;
        v_reduction := v_qty * v_weight;

        -- Atomic Stock Deduction
        UPDATE products 
        SET stock = stock - v_reduction,
            updated_at = NOW()
        WHERE id = v_p_id;

        IF NOT FOUND THEN 
            RAISE EXCEPTION 'Product % not found during order processing', v_p_id; 
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
        
        -- Log Inventory change
        INSERT INTO inventory_history (product_id, type, change_amount, resulting_stock, source, reason)
        SELECT v_p_id, 'SALE', -v_reduction, stock, 'ORDER_PLACEMENT', 'Order #' || v_order_id
        FROM products WHERE id = v_p_id;
    END LOOP;

    -- 3. Update Order with final Total
    UPDATE orders SET total_price = v_total WHERE id = v_order_id;

    RETURN v_order_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. ROW LEVEL SECURITY
-- (Existing table RLS remains the same as previously defined)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- 6. POLICIES
-- Clean up existing policies before recreating to ensure idempotency
DROP POLICY IF EXISTS "Public products access" ON products;
DROP POLICY IF EXISTS "Public categories access" ON categories;
DROP POLICY IF EXISTS "Public brands access" ON brands;
DROP POLICY IF EXISTS "Public collections access" ON collections;
DROP POLICY IF EXISTS "Public tags access" ON tags;
DROP POLICY IF EXISTS "Public site_settings access" ON site_settings;
DROP POLICY IF EXISTS "Admin full access" ON products;
DROP POLICY IF EXISTS "Admin full access" ON orders;
DROP POLICY IF EXISTS "Admin full access" ON customers;
DROP POLICY IF EXISTS "Admin full access" ON admins;

-- Re-creating optimized policies
CREATE POLICY "Public products access" ON products FOR SELECT USING (true);
CREATE POLICY "Public categories access" ON categories FOR SELECT USING (true);
CREATE POLICY "Public brands access" ON brands FOR SELECT USING (true);
CREATE POLICY "Public collections access" ON collections FOR SELECT USING (true);
CREATE POLICY "Public tags access" ON tags FOR SELECT USING (true);
CREATE POLICY "Public site_settings access" ON site_settings FOR SELECT USING (true);

-- Admin Full Access
CREATE POLICY "Admin full access" ON products FOR ALL USING (true);
CREATE POLICY "Admin full access" ON orders FOR ALL USING (true);
CREATE POLICY "Admin full access" ON customers FOR ALL USING (true);
CREATE POLICY "Admin full access" ON admins FOR ALL USING (true);

