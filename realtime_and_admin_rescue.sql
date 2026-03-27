-- ============================================================================
-- REAL-TIME AND ADMIN PANEL RESCUE SCRIPT
-- Run this in your Supabase SQL Editor to fix access and real-time issues.
-- ============================================================================

-- 1. Ensure the 'admins' table exists correctly
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'ADMIN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
DO UPDATE SET role = 'SUPER_ADMIN', name = 'Super Admin';

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
-- This allows the 'postgres_changes' event to broadcast to the frontend.
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE brands;

-- If they were already added, the above might error silently or be ignored.
-- To be safe, we can use this alternative if ADD TABLE complains about existing:
/*
ALTER PUBLICATION supabase_realtime SET TABLE 
    orders, products, customers, inventory_logs, notifications, brands;
*/

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

-- ============================================================
-- DONE!
-- Please refresh your admin dashboard after running this.
-- ============================================================
