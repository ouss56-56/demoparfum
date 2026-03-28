-- PHASE 3 & 4: DATABASE REDESIGN & SQL OUTPUT
-- B2B PLATFORM CORE ARCHITECTURE (2026-03-28)

-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE invoice_status AS ENUM ('PAID', 'UNPAID', 'PARTIALLY_PAID', 'VOID');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. CORE TABLES

-- USERS (Profiles linked to Auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    shop_name TEXT,
    phone TEXT UNIQUE NOT NULL,
    wilaya_code TEXT,
    commune_name TEXT,
    address TEXT,
    role TEXT DEFAULT 'TRADER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PRODUCTS
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    brand TEXT,
    description TEXT,
    image_url TEXT,
    images JSONB DEFAULT '[]',
    volumes JSONB DEFAULT '[]', -- [{id: 'v100', weight: 100, price: 1000}, ...]
    base_price NUMERIC DEFAULT 0,
    purchase_price NUMERIC DEFAULT 0,
    stock_weight NUMERIC DEFAULT 0, -- Total weight in grams
    low_stock_threshold NUMERIC DEFAULT 500,
    status TEXT DEFAULT 'ACTIVE',
    sales_units_sold NUMERIC DEFAULT 0,
    sales_revenue NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ORDERS
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status order_status DEFAULT 'PENDING',
    total_price NUMERIC NOT NULL DEFAULT 0,
    amount_paid NUMERIC DEFAULT 0,
    payment_status invoice_status DEFAULT 'UNPAID',
    wilaya_code TEXT,
    commune_name TEXT,
    notes TEXT,
    shipping_details JSONB DEFAULT '{}', -- {company, tracking_number, date}
    logs JSONB DEFAULT '[]', -- History of status changes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    quantity NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    volume_data JSONB NOT NULL, -- Snapshot of volume used: {id, weight, price}
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INVOICES (NEW TABLE)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    total_amount NUMERIC NOT NULL,
    status invoice_status DEFAULT 'UNPAID',
    issue_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date TIMESTAMP WITH TIME ZONE,
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- 4. ATOMIC LOGIC & TRIGGERS

-- Function to handle stock adjustment
CREATE OR REPLACE FUNCTION adjust_product_stock() 
RETURNS TRIGGER AS $$
DECLARE
    v_item_weight NUMERIC;
BEGIN
    -- If order status changes to CANCELLED, return stock
    IF (TG_OP = 'UPDATE' AND OLD.status != 'CANCELLED' AND NEW.status = 'CANCELLED') THEN
        FOR v_item_weight IN 
            SELECT (volume_data->>'weight')::NUMERIC * quantity 
            FROM order_items WHERE order_id = NEW.id
        LOOP
            -- Logic to identify product and update stock
            -- Note: For simplicity in this script, we assume a relation
            UPDATE products p
            SET stock_weight = stock_weight + v_item_weight
            FROM order_items oi
            WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGER: Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tr_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. PHASE 5: RLS POLICIES

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- ADMIN POLICIES (Assuming 'admin' metadata or specific role)
-- For this demo, we'll use a check on the 'role' column in users
CREATE POLICY "Admin full access users" ON users FOR ALL USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'ADMIN'
);

CREATE POLICY "Admin full access products" ON products FOR ALL USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'ADMIN'
);

CREATE POLICY "Admin full access orders" ON orders FOR ALL USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'ADMIN'
);

CREATE POLICY "Admin full access order_items" ON order_items FOR ALL USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'ADMIN'
);

CREATE POLICY "Admin full access invoices" ON invoices FOR ALL USING (
    (SELECT role FROM users WHERE id = auth.uid()) = 'ADMIN'
);

-- CLIENT POLICIES (Traders)
CREATE POLICY "User self view profile" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Public product viewing" ON products FOR SELECT USING (status = 'ACTIVE');

CREATE POLICY "Trader view own orders" ON orders FOR SELECT USING (customer_id = auth.uid());
CREATE POLICY "Trader insert own orders" ON orders FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Trader view own invoices" ON invoices FOR SELECT USING (customer_id = auth.uid());

-- 6. SAMPLE DATA

-- Insert Sample Products
INSERT INTO products (name, slug, brand, base_price, stock_weight, status) VALUES
('Bleu de Chanel', 'bleu-de-chanel', 'Chanel', 1500, 5000, 'ACTIVE'),
('Sauvage', 'sauvage-dior', 'Dior', 1400, 3000, 'ACTIVE')
ON CONFLICT (slug) DO NOTHING;

-- Note: Users must be created via Auth first, then profile synced.
-- Sample orders and invoices would be created via the application logic.
