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

async function verify() {
    try {
        console.log("--- Verifying getInvoices Query (LEFT JOIN) ---");
        const data = await sql`
            SELECT 
                i.*,
                c.id as cust_id, c.shop_name, c.name as customer_name,
                o.status as order_status, o.total_price as order_total, 
                o.payment_status, o.amount_paid
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN orders o ON i.order_id = o.id
            ORDER BY i.issue_date DESC
            LIMIT 5
        `;
        console.log("Invoices found via query:", data.length);
        if (data.length > 0) {
            console.log("First invoice details:", {
                invoiceNumber: data[0].invoice_number,
                shopName: data[0].shop_name,
                orderStatus: data[0].order_status
            });
        }

        console.log("\n--- Verifying Notifications Table ---");
        const notifs = await sql`SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5`;
        console.log("Notifications found:", notifs.length);

    } catch (err) {
        console.error("Verification Error:", err);
    } finally {
        await sql.end();
    }
}

verify();
