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

async function fixAndBackfill() {
    try {
        console.log("--- Relaxing Invoices Constraints ---");
        // Drop the constraint if it exists
        await sql`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_customer_id_fkey`;
        await sql`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_order_id_fkey`;
        
        // Add them back as simple columns (they already are) but without strict FK if needed
        // Actually, we'll keep them as simple UUID columns for now.
        console.log("Constraints relaxed.");

        console.log("\n--- Backfilling data from Orders JSONB ---");
        const orders = await sql`SELECT id, invoice, customer_id, total_price, created_at FROM orders WHERE invoice IS NOT NULL`;
        console.log(`Found ${orders.length} orders with invoice data.`);

        let successCount = 0;
        for (const order of orders) {
            const inv = order.invoice;
            if (inv && inv.invoiceNumber) {
                try {
                    await sql`
                        INSERT INTO invoices (invoice_number, order_id, customer_id, total_amount, issue_date)
                        VALUES (
                            ${inv.invoiceNumber}, 
                            ${order.id}, 
                            ${order.customer_id}, 
                            ${Number(inv.totalAmount || order.total_price || 0)},
                            ${inv.issueDate || order.created_at}
                        )
                        ON CONFLICT (invoice_number) DO UPDATE SET 
                            order_id = EXCLUDED.order_id,
                            customer_id = EXCLUDED.customer_id,
                            total_amount = EXCLUDED.total_amount
                    `;
                    successCount++;
                } catch (e) {
                    console.error(`Failed to backfill for order ${order.id}:`, e.message);
                }
            }
        }
        console.log(`Successfully backfilled ${successCount} invoices.`);

        // Now that we have data, let's verify again
        const count = await sql`SELECT COUNT(*) FROM invoices`;
        console.log(`Invoices table now has ${count[0].count} rows.`);

    } catch (err) {
        console.error("Fix and Backfill Error:", err);
    } finally {
        await sql.end();
    }
}

fixAndBackfill();
