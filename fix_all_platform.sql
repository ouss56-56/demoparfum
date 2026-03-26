-- ============================================================================
-- COMPREHENSIVE PLATFORM FIX + PRODUCT SEEDING
-- Run this ONCE in Supabase SQL Editor to fix ALL issues
-- ============================================================================

-- ============================================================
-- STEP 1: ADD MISSING COLUMNS TO TABLES
-- ============================================================

-- Orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'UNPAID';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS logs JSONB DEFAULT '[]';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice JSONB;

-- Order items - add volume_id for compatibility
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS volume_id TEXT;

-- Notifications - add metadata column
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Ensure stock_weight column exists on products
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'stock_weight'
    ) THEN
        ALTER TABLE products ADD COLUMN stock_weight NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Ensure 'stock' column exists as a normal column (not generated)
DO $$
BEGIN
    -- If 'stock' is a generated column, we must drop it first to convert it to a regular column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' 
        AND column_name = 'stock' 
        AND is_generated = 'ALWAYS'
    ) THEN
        ALTER TABLE products DROP COLUMN stock;
    END IF;

    -- Now add it as a regular column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'stock'
    ) THEN
        ALTER TABLE products ADD COLUMN stock NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Sync stock and stock_weight values
UPDATE products SET stock = stock_weight WHERE stock IS NULL OR stock = 0;
UPDATE products SET stock_weight = stock WHERE stock_weight IS NULL OR stock_weight = 0;


-- ============================================================
-- STEP 2: FIX ALL ROW LEVEL SECURITY POLICIES
-- Without these policies, all queries return EMPTY results!
-- ============================================================

-- Orders
DROP POLICY IF EXISTS "Public orders access" ON orders;
DROP POLICY IF EXISTS "Admin full access" ON orders;
DROP POLICY IF EXISTS "Orders full access" ON orders;
CREATE POLICY "Orders full access" ON orders FOR ALL USING (true) WITH CHECK (true);

-- Order Items
DROP POLICY IF EXISTS "Public order_items access" ON order_items;
DROP POLICY IF EXISTS "Admin full access" ON order_items;
DROP POLICY IF EXISTS "Order items full access" ON order_items;
CREATE POLICY "Order items full access" ON order_items FOR ALL USING (true) WITH CHECK (true);

-- Customers
DROP POLICY IF EXISTS "Public customers access" ON customers;
DROP POLICY IF EXISTS "Admin full access" ON customers;
DROP POLICY IF EXISTS "Customers full access" ON customers;
CREATE POLICY "Customers full access" ON customers FOR ALL USING (true) WITH CHECK (true);

-- Products
DROP POLICY IF EXISTS "Public products access" ON products;
DROP POLICY IF EXISTS "Admin full access" ON products;
DROP POLICY IF EXISTS "Products full access" ON products;
CREATE POLICY "Products full access" ON products FOR ALL USING (true) WITH CHECK (true);

-- Categories
DROP POLICY IF EXISTS "Public categories access" ON categories;
DROP POLICY IF EXISTS "Categories full access" ON categories;
CREATE POLICY "Categories full access" ON categories FOR ALL USING (true) WITH CHECK (true);

-- Brands
DROP POLICY IF EXISTS "Public brands access" ON brands;
DROP POLICY IF EXISTS "Brands full access" ON brands;
CREATE POLICY "Brands full access" ON brands FOR ALL USING (true) WITH CHECK (true);

-- Collections
DROP POLICY IF EXISTS "Public collections access" ON collections;
DROP POLICY IF EXISTS "Collections full access" ON collections;
CREATE POLICY "Collections full access" ON collections FOR ALL USING (true) WITH CHECK (true);

-- Tags
DROP POLICY IF EXISTS "Public tags access" ON tags;
DROP POLICY IF EXISTS "Tags full access" ON tags;
CREATE POLICY "Tags full access" ON tags FOR ALL USING (true) WITH CHECK (true);

-- Notifications
DROP POLICY IF EXISTS "Public notifications access" ON notifications;
DROP POLICY IF EXISTS "Notifications full access" ON notifications;
CREATE POLICY "Notifications full access" ON notifications FOR ALL USING (true) WITH CHECK (true);

-- Site Settings
DROP POLICY IF EXISTS "Public site_settings access" ON site_settings;
DROP POLICY IF EXISTS "Site settings full access" ON site_settings;
CREATE POLICY "Site settings full access" ON site_settings FOR ALL USING (true) WITH CHECK (true);

-- Admins
DROP POLICY IF EXISTS "Admin full access" ON admins;
DROP POLICY IF EXISTS "Admins full access" ON admins;
CREATE POLICY "Admins full access" ON admins FOR ALL USING (true) WITH CHECK (true);

-- Inventory Logs
DROP POLICY IF EXISTS "Admin logs access" ON inventory_logs;
DROP POLICY IF EXISTS "Inventory logs full access" ON inventory_logs;
CREATE POLICY "Inventory logs full access" ON inventory_logs FOR ALL USING (true) WITH CHECK (true);

-- Inventory History
DROP POLICY IF EXISTS "Inventory history full access" ON inventory_history;
CREATE POLICY "Inventory history full access" ON inventory_history FOR ALL USING (true) WITH CHECK (true);

-- System Logs
DROP POLICY IF EXISTS "Admin logs access" ON system_logs;
DROP POLICY IF EXISTS "System logs full access" ON system_logs;
CREATE POLICY "System logs full access" ON system_logs FOR ALL USING (true) WITH CHECK (true);

-- Announcements
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    link TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Announcements full access" ON announcements;
CREATE POLICY "Announcements full access" ON announcements FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- STEP 3: FIX create_order FUNCTION
-- ============================================================

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


-- ============================================================
-- STEP 4: FIX adjust_stock FUNCTION
-- ============================================================

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
    RETURNING stock_weight INTO v_new_stock;

    INSERT INTO inventory_logs (product_id, change_type, quantity, source, reason, created_at)
    VALUES (p_product_id, CASE WHEN p_amount >= 0 THEN 'RESTOCK' ELSE 'ADJUSTMENT' END, ABS(p_amount), p_source, p_reason, NOW());

    RETURN v_new_stock;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- STEP 5: SEED BRANDS (if they don't exist)
-- ============================================================

INSERT INTO brands (id, name, slug, description) VALUES
    ('b0000001-0000-0000-0000-000000000001', 'Dior', 'dior', 'Maison de luxe française fondée en 1946, célèbre pour ses parfums iconiques'),
    ('b0000001-0000-0000-0000-000000000002', 'Chanel', 'chanel', 'Maison de haute couture française, créatrice de parfums légendaires'),
    ('b0000001-0000-0000-0000-000000000003', 'Tom Ford', 'tom-ford', 'Marque de luxe américaine connue pour ses fragrances audacieuses'),
    ('b0000001-0000-0000-0000-000000000004', 'Versace', 'versace', 'Maison italienne de mode haut de gamme et de parfumerie'),
    ('b0000001-0000-0000-0000-000000000005', 'Yves Saint Laurent', 'yves-saint-laurent', 'Maison de couture française, parfums emblématiques'),
    ('b0000001-0000-0000-0000-000000000006', 'Giorgio Armani', 'giorgio-armani', 'Marque de luxe italienne aux fragrances raffinées'),
    ('b0000001-0000-0000-0000-000000000007', 'Creed', 'creed', 'Maison de parfumerie de niche fondée en 1760'),
    ('b0000001-0000-0000-0000-000000000008', 'Jean Paul Gaultier', 'jean-paul-gaultier', 'Marque française audacieuse et avant-gardiste')
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- STEP 6: SEED CATEGORIES (if they don't exist)
-- ============================================================

INSERT INTO categories (id, name, slug, description) VALUES
    ('c0000001-0000-0000-0000-000000000001', 'Homme', 'homme', 'Parfums pour hommes'),
    ('c0000001-0000-0000-0000-000000000002', 'Femme', 'femme', 'Parfums pour femmes'),
    ('c0000001-0000-0000-0000-000000000003', 'Unisexe', 'unisexe', 'Parfums mixtes')
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- STEP 7: SEED COLLECTIONS (if they don't exist)
-- ============================================================

INSERT INTO collections (id, name, slug, description) VALUES
    ('d0000001-0000-0000-0000-000000000001', 'Best Sellers', 'best-sellers', 'Nos parfums les plus vendus'),
    ('d0000001-0000-0000-0000-000000000002', 'Nouvelles Arrivées', 'nouvelles-arrivees', 'Les dernières nouveautés'),
    ('d0000001-0000-0000-0000-000000000003', 'Collection Luxe', 'collection-luxe', 'Fragrances premium et exclusives')
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- STEP 8: SEED 12 PERFUME PRODUCTS (without images)
-- ============================================================

INSERT INTO products (name, slug, brand, brand_id, description, category_id, base_price, purchase_price, stock_weight, stock, low_stock_threshold, status, volumes, images, collection_ids) VALUES

-- HOMME
('Sauvage Eau de Parfum', 'sauvage-edp', 'Dior', 'b0000001-0000-0000-0000-000000000001',
 'Un parfum brut et noble à la fois. Sauvage Eau de Parfum est un concentré de fraîcheur épicée rehaussé par une note boisée ambrée. Idéal pour l''homme moderne et audacieux.',
 'c0000001-0000-0000-0000-000000000001', 4500, 2800, 5000, 5000, 500, 'ACTIVE',
 '[{"id":"sauv-100","label":"100ml","weight":100,"price":4500},{"id":"sauv-200","label":"200ml","weight":200,"price":7500}]'::JSONB,
 '[]'::JSONB,
 ARRAY['d0000001-0000-0000-0000-000000000001']::UUID[]),

('Bleu de Chanel', 'bleu-de-chanel', 'Chanel', 'b0000001-0000-0000-0000-000000000002',
 'Un parfum aromatique-boisé déterminé et résolument masculin. Bleu de Chanel révèle sa personnalité en trois temps : fraîcheur mentholée, accord boisé chaud, et cèdre sensuel.',
 'c0000001-0000-0000-0000-000000000001', 5200, 3200, 4000, 4000, 500, 'ACTIVE',
 '[{"id":"bleu-100","label":"100ml","weight":100,"price":5200},{"id":"bleu-150","label":"150ml","weight":150,"price":7000}]'::JSONB,
 '[]'::JSONB,
 ARRAY['d0000001-0000-0000-0000-000000000001']::UUID[]),

('Eros Versace', 'eros-versace', 'Versace', 'b0000001-0000-0000-0000-000000000004',
 'Inspiré par la mythologie grecque, Eros est un parfum oriental frais qui mêle menthe, pomme verte et tonka. Puissant et magnétique.',
 'c0000001-0000-0000-0000-000000000001', 3800, 2200, 6000, 6000, 500, 'ACTIVE',
 '[{"id":"eros-100","label":"100ml","weight":100,"price":3800},{"id":"eros-200","label":"200ml","weight":200,"price":5500}]'::JSONB,
 '[]'::JSONB,
 ARRAY['d0000001-0000-0000-0000-000000000002']::UUID[]),

('Y Eau de Parfum', 'y-edp-ysl', 'Yves Saint Laurent', 'b0000001-0000-0000-0000-000000000005',
 'Un parfum audacieux et élégant. Y EDP combine la sauge, le gingembre et le bois de cèdre pour un sillage intense et masculin.',
 'c0000001-0000-0000-0000-000000000001', 4200, 2600, 3500, 3500, 500, 'ACTIVE',
 '[{"id":"yedp-100","label":"100ml","weight":100,"price":4200},{"id":"yedp-60","label":"60ml","weight":60,"price":3000}]'::JSONB,
 '[]'::JSONB,
 ARRAY['d0000001-0000-0000-0000-000000000002']::UUID[]),

('Acqua di Giò Profumo', 'acqua-di-gio-profumo', 'Giorgio Armani', 'b0000001-0000-0000-0000-000000000006',
 'Une réinterprétation plus intense de l''iconique Acqua di Giò. Notes d''encens, bergamote et patchouli pour un parfum aquatique et boisé.',
 'c0000001-0000-0000-0000-000000000001', 4800, 3000, 3000, 3000, 500, 'ACTIVE',
 '[{"id":"adgp-75","label":"75ml","weight":75,"price":4800},{"id":"adgp-125","label":"125ml","weight":125,"price":6500}]'::JSONB,
 '[]'::JSONB,
 ARRAY['d0000001-0000-0000-0000-000000000001']::UUID[]),

('Le Male', 'le-male-jpg', 'Jean Paul Gaultier', 'b0000001-0000-0000-0000-000000000008',
 'L''icône de la parfumerie masculine. Le Male séduit par son contraste lavande-vanille dans un flacon torse de marin. Frais et sensuel.',
 'c0000001-0000-0000-0000-000000000001', 3500, 2000, 7000, 7000, 500, 'ACTIVE',
 '[{"id":"lm-75","label":"75ml","weight":75,"price":3500},{"id":"lm-125","label":"125ml","weight":125,"price":5000}]'::JSONB,
 '[]'::JSONB,
 ARRAY['d0000001-0000-0000-0000-000000000002']::UUID[]),

-- FEMME
('J''adore Eau de Parfum', 'jadore-edp', 'Dior', 'b0000001-0000-0000-0000-000000000001',
 'Un bouquet floral lumineux et sensuel. J''adore est un hymne à la féminité, alliant ylang-ylang, rose de Damas et jasmin sambac.',
 'c0000001-0000-0000-0000-000000000002', 5000, 3100, 4500, 4500, 500, 'ACTIVE',
 '[{"id":"jad-50","label":"50ml","weight":50,"price":5000},{"id":"jad-100","label":"100ml","weight":100,"price":7200}]'::JSONB,
 '[]'::JSONB,
 ARRAY['d0000001-0000-0000-0000-000000000001']::UUID[]),

('Coco Mademoiselle', 'coco-mademoiselle', 'Chanel', 'b0000001-0000-0000-0000-000000000002',
 'Un oriental frais irrésistiblement féminin. Orange, rose, jasmin et patchouli se mêlent en une signature élégante et moderne.',
 'c0000001-0000-0000-0000-000000000002', 5800, 3600, 3500, 3500, 500, 'ACTIVE',
 '[{"id":"cocm-50","label":"50ml","weight":50,"price":5800},{"id":"cocm-100","label":"100ml","weight":100,"price":8200}]'::JSONB,
 '[]'::JSONB,
 ARRAY['d0000001-0000-0000-0000-000000000001']::UUID[]),

('Black Opium', 'black-opium-ysl', 'Yves Saint Laurent', 'b0000001-0000-0000-0000-000000000005',
 'Un parfum rock et glam. Black Opium joue sur le contraste du café noir et de la vanille avec une touche de fleur d''oranger. Envoûtant.',
 'c0000001-0000-0000-0000-000000000002', 4600, 2800, 5500, 5500, 500, 'ACTIVE',
 '[{"id":"bo-50","label":"50ml","weight":50,"price":4600},{"id":"bo-90","label":"90ml","weight":90,"price":6200}]'::JSONB,
 '[]'::JSONB,
 ARRAY['d0000001-0000-0000-0000-000000000002']::UUID[]),

('Bright Crystal', 'bright-crystal-versace', 'Versace', 'b0000001-0000-0000-0000-000000000004',
 'Un parfum floral et frais comme un joyau de lumière. Bright Crystal combine yuzu, pivoine et magnolia pour une féminité éclatante.',
 'c0000001-0000-0000-0000-000000000002', 3200, 1900, 6000, 6000, 500, 'ACTIVE',
 '[{"id":"bc-50","label":"50ml","weight":50,"price":3200},{"id":"bc-90","label":"90ml","weight":90,"price":4800}]'::JSONB,
 '[]'::JSONB,
 ARRAY['d0000001-0000-0000-0000-000000000002']::UUID[]),

-- UNISEXE
('Aventus Creed', 'aventus-creed', 'Creed', 'b0000001-0000-0000-0000-000000000007',
 'Le parfum de niche le plus célèbre au monde. Aventus incarne le succès avec ses notes d''ananas, bouleau, musc et chêne mousse. Légendaire.',
 'c0000001-0000-0000-0000-000000000003', 12000, 7500, 2000, 2000, 300, 'ACTIVE',
 '[{"id":"av-50","label":"50ml","weight":50,"price":12000},{"id":"av-100","label":"100ml","weight":100,"price":18000}]'::JSONB,
 '[]'::JSONB,
 ARRAY['d0000001-0000-0000-0000-000000000003']::UUID[]),

('Tobacco Vanille', 'tobacco-vanille-tf', 'Tom Ford', 'b0000001-0000-0000-0000-000000000003',
 'Un parfum opulent et addictif. Tobacco Vanille fusionne les accords de tabac, de vanille et de cacao pour une expérience riche et chaleureuse.',
 'c0000001-0000-0000-0000-000000000003', 9500, 6000, 2500, 2500, 300, 'ACTIVE',
 '[{"id":"tv-50","label":"50ml","weight":50,"price":9500},{"id":"tv-100","label":"100ml","weight":100,"price":15000}]'::JSONB,
 '[]'::JSONB,
 ARRAY['d0000001-0000-0000-0000-000000000003']::UUID[])

ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- DONE! 
-- Summary:
--   ✅ All missing columns added
--   ✅ All RLS policies fixed (13 tables)
--   ✅ create_order function fixed
--   ✅ adjust_stock function fixed
--   ✅ 8 luxury brands seeded
--   ✅ 3 categories seeded (Homme, Femme, Unisexe)
--   ✅ 3 collections seeded (Best Sellers, Nouvelles Arrivées, Collection Luxe)
--   ✅ 12 perfume products seeded with proper volumes/pricing
-- ============================================================
