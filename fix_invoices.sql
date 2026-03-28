-- 1. Create invoices table with correct schema
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'UNPAID',
    issue_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS and add policy
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Invoices full access" ON invoices;
CREATE POLICY "Invoices full access" ON invoices FOR ALL USING (true) WITH CHECK (true);

-- 3. Add invoice_number column to orders for fast lookup
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_number TEXT;

-- 4. Backfill existing invoice data from JSONB to the new column and table
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, invoice, customer_id, total_price, created_at FROM orders WHERE invoice IS NOT NULL LOOP
        -- Update orders.invoice_number if it exists in JSON
        IF r.invoice ? 'invoiceNumber' THEN
            UPDATE orders SET invoice_number = r.invoice->>'invoiceNumber' WHERE id = r.id;
            
            -- Insert into invoices table if not exists
            INSERT INTO invoices (invoice_number, order_id, customer_id, total_amount, issue_date)
            VALUES (
                r.invoice->>'invoiceNumber', 
                r.id, 
                r.customer_id, 
                COALESCE((r.invoice->>'totalAmount')::NUMERIC, r.total_price),
                COALESCE((r.invoice->>'issueDate')::TIMESTAMP WITH TIME ZONE, r.created_at)
            )
            ON CONFLICT (invoice_number) DO NOTHING;
        END IF;
    END LOOP;
END $$;
