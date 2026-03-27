-- ============================================================================
-- REAL-TIME AND ADMIN PANEL RESCUE SCRIPT
-- Run this in your Supabase SQL Editor to fix access and real-time issues.
-- ============================================================================

-- 1. Ensure the 'admins' table and its columns exist correctly
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'ADMIN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure columns exist if the table was created by a previous script without them
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='password_hash') THEN
        ALTER TABLE admins ADD COLUMN password_hash TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admins' AND column_name='role') THEN
        ALTER TABLE admins ADD COLUMN role TEXT DEFAULT 'ADMIN';
    END IF;
END $$;

-- 2. Provision/Reset the default Super Admin
-- Password is '123456'
-- If the admin already exists, we ensure it has the SUPER_ADMIN role.
INSERT INTO admins (email, password_hash, name, role)
VALUES (
    'admin@gmail.com', 
    '$2b$10$MMKnR5w34mp0DyMlEGJ0mOtxfHfaZzDLJ3v2KEOqtkg8KQtV.LR6i', 
    'Super Admin', 
    'SUPER_ADMIN'
)
ON CONFLICT (email) 
DO UPDATE SET 
    role = 'SUPER_ADMIN', 
    name = 'Super Admin',
    password_hash = EXCLUDED.password_hash;

-- 3. Enable RLS and Policies for Admins table
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins full access" ON admins;
CREATE POLICY "Admins full access" ON admins FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. ENABLE REAL-TIME REPLICATION (CRITICAL)
-- ============================================================

-- First, ensure the 'supabase_realtime' publication exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Enable replication for specific tables that need real-time updates
-- Using SET TABLE ensures this exact list is synchronized without "already exists" errors.
ALTER PUBLICATION supabase_realtime SET TABLE 
    orders, products, customers, inventory_logs, notifications, brands, admins;

-- 5. Fix RLS for real-time visibility
-- Real-time usually requires either 'SELECT' access for 'anon' or 'authenticated' roles.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Real-time orders visibility" ON orders;
CREATE POLICY "Real-time orders visibility" ON orders FOR SELECT USING (true);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Real-time products visibility" ON products;
CREATE POLICY "Real-time products visibility" ON products FOR SELECT USING (true);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Real-time notifications visibility" ON notifications;
CREATE POLICY "Real-time notifications visibility" ON notifications FOR SELECT USING (true);

-- 6. Ensure core tables exist sufficiently for the dashboard to load (Prevent 404/Null crashes)
-- These are basic definitions that 'fix_all_platform.sql' will further refine.
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    stock_weight DECIMAL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_price DECIMAL DEFAULT 0,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    shop_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- DONE!
-- Please refresh your admin dashboard after running this.
-- ============================================================
