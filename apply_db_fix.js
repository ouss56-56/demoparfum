const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

// Manually read .env.local
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        env[key] = value;
    }
});

const sql = postgres(env.DATABASE_URL, { ssl: 'require' });

async function applyFix() {
    try {
        console.log("--- Updating Notifications Table ---");
        await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES customers(id) ON DELETE CASCADE`;
        await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB`;
        console.log("Columns added/verified.");

        console.log("\n--- Fixing RLS Policies ---");
        // For invoices
        await sql`ALTER TABLE invoices ENABLE ROW LEVEL SECURITY`;
        await sql`DROP POLICY IF EXISTS "Invoices full access" ON invoices`;
        await sql`CREATE POLICY "Invoices full access" ON invoices FOR ALL USING (true) WITH CHECK (true)`;
        
        // For notifications
        await sql`ALTER TABLE notifications ENABLE ROW LEVEL SECURITY`;
        await sql`DROP POLICY IF EXISTS "Notifications full access" ON notifications`;
        await sql`CREATE POLICY "Notifications full access" ON notifications FOR ALL USING (true) WITH CHECK (true)`;
        
        console.log("Policies updated.");

    } catch (err) {
        console.error("Fix Application Error:", err);
    } finally {
        await sql.end();
    }
}

applyFix();
