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

async function debug() {
    try {
        console.log("--- Checking Invoices Table ---");
        const invoicesTable = await sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'invoices')`;
        console.log("Table 'invoices' exists:", invoicesTable[0].exists);

        if (invoicesTable[0].exists) {
            const invoicesCount = await sql`SELECT COUNT(*) FROM invoices`;
            console.log("Invoices count:", invoicesCount[0].count);

            if (invoicesCount[0].count > 0) {
                const firstInvoice = await sql`SELECT * FROM invoices LIMIT 1`;
                console.log("First invoice:", JSON.stringify(firstInvoice[0], null, 2));
            }
        }

        console.log("\n--- Checking Notifications Table ---");
        const notificationsTable = await sql`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications')`;
        console.log("Table 'notifications' exists:", notificationsTable[0].exists);

        if (notificationsTable[0].exists) {
            const notificationsCount = await sql`SELECT COUNT(*) FROM notifications`;
            console.log("Notifications count:", notificationsCount[0].count);

            if (notificationsCount[0].count > 0) {
                const firstNotification = await sql`SELECT * FROM notifications LIMIT 1`;
                console.log("First notification:", JSON.stringify(firstNotification[0], null, 2));
            }
        }

        console.log("\n--- Checking Orders with Invoices ---");
        const ordersWithInvoice = await sql`SELECT COUNT(*) FROM orders WHERE invoice IS NOT NULL OR invoice_number IS NOT NULL`;
        console.log("Orders with invoice data (JSONB or column):", ordersWithInvoice[0].count);

        if (invoicesTable[0].exists) {
            console.log("\n--- Testing getInvoices Query ---");
            const data = await sql`
                SELECT 
                    i.*,
                    c.id as cust_id, c.shop_name, c.name as customer_name,
                    o.status as order_status, o.total_price as order_total, 
                    o.payment_status, o.amount_paid
                FROM invoices i
                JOIN customers c ON i.customer_id = c.id
                JOIN orders o ON i.order_id = o.id
                LIMIT 5
            `;
            console.log("getInvoices join result count:", data.length);
        }

    } catch (err) {
        console.error("Debug Error:", err);
    } finally {
        await sql.end();
    }
}

debug();
