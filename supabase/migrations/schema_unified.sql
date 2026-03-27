-- Unified Schema for Perfume B2B Platform (Production Ready)
-- Consolidates all tables, triggers, and RPCs

-- 0. ENABLE UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. LOCATIONS (States & Cities / Wilayas & Communes)
CREATE TABLE IF NOT EXISTS wilayas (
    id TEXT PRIMARY KEY, -- "01", "02", etc.
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS communes (
    id SERIAL PRIMARY KEY,
    wilaya_id TEXT REFERENCES wilayas(id),
    name TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. USERS & ROLES
-- Note: We use the existing 'customers' table as the base but normalize it.
-- For Admins, we use a separate table or a role in this table. 
-- The current app separates them, so we'll maintain 'admins' and 'customers' for now but align schemas.

CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    id_name TEXT UNIQUE, -- e.g., 'admin1'
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'ADMIN', -- 'SUPER_ADMIN', 'ADMIN', 'VENDOR'
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    shop_name TEXT,
    wilaya_id TEXT REFERENCES wilayas(id),
    commune_id INTEGER REFERENCES communes(id),
    address TEXT,
    role TEXT DEFAULT 'TRADER',
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'PENDING', 'SUSPENDED'
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. PRODUCTS & CATALOG
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    image_url TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    brand_id UUID REFERENCES brands(id),
    category_id UUID REFERENCES categories(id),
    description TEXT,
    image_url TEXT,
    images JSONB DEFAULT '[]',
    volumes JSONB DEFAULT '[]', -- List of volume objects {id, weight, price, purchasePrice}
    base_price NUMERIC DEFAULT 0,
    stock NUMERIC DEFAULT 0, -- Total weight in grams/ml
    low_stock_threshold NUMERIC DEFAULT 500,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ORDERS & TRANSACTIONS
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id),
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'
    total_price NUMERIC DEFAULT 0,
    amount_paid NUMERIC DEFAULT 0,
    payment_status TEXT DEFAULT 'UNPAID', -- 'UNPAID', 'PARTIAL', 'PAID', 'SHIPPED_UNPAID'
    items JSONB DEFAULT '[]', -- SNAPSHOT
    notes TEXT,
    wilaya_name TEXT,
    wilaya_number TEXT,
    commune_name TEXT,
    shipping_info JSONB DEFAULT '{}',
    logs JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    volume_data JSONB, -- The volume object used at time of purchase
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID, -- Can be admin or customer
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'INFO', -- 'ORDER', 'STOCK', 'SYSTEM'
    is_read BOOLEAN DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TRIGGERS & FUNCTIONS

-- Function to handle order item normalization automatically
CREATE OR REPLACE FUNCTION sync_order_items_trigger() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        DELETE FROM order_items WHERE order_id = NEW.id;
    END IF;

    INSERT INTO order_items (order_id, product_id, quantity, price, volume_data)
    SELECT 
        NEW.id,
        (item->>'productId')::UUID,
        (item->>'quantity')::NUMERIC,
        (item->>'price')::NUMERIC,
        (item->'volume')
    FROM jsonb_array_elements(NEW.items) AS item;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_order_sync_items ON orders;
CREATE TRIGGER on_order_sync_items
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION sync_order_items_trigger();

-- Function for Atomic Order Creation (RPC)
CREATE OR REPLACE FUNCTION create_order_v2(
    p_customer_id UUID,
    p_items JSONB,
    p_wilaya_name TEXT,
    p_wilaya_number TEXT,
    p_commune_name TEXT,
    p_notes TEXT
) RETURNS UUID AS $$
DECLARE
    v_order_id UUID;
    v_total NUMERIC := 0;
    v_item JSONB;
BEGIN
    -- Calculate total
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_total := v_total + (v_item->>'price')::NUMERIC * (v_item->>'quantity')::NUMERIC;
    END LOOP;

    INSERT INTO orders (
        customer_id, total_price, items, 
        wilaya_name, wilaya_number, commune_name, 
        notes
    )
    VALUES (
        p_customer_id, v_total, p_items, 
        p_wilaya_name, p_wilaya_number, p_commune_name, 
        p_notes
    )
    RETURNING id INTO v_order_id;
    
    RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;
