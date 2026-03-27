const postgres = require('postgres');
require('dotenv').config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
});

async function checkLocations() {
    try {
        const wilayas = await sql`SELECT count(*) FROM wilayas`;
        const communes = await sql`SELECT count(*) FROM communes`;
        const orders = await sql`SELECT count(*) FROM orders`;
        console.log("Counts:", { 
            wilayas: wilayas[0].count, 
            communes: communes[0].count, 
            orders: orders[0].count 
        });

        if (wilayas[0].count > 0) {
            const firstWilayas = await sql`SELECT * FROM wilayas LIMIT 5`;
            console.log("First 5 Wilayas:", firstWilayas);
        }

        if (communes[0].count > 0) {
            const firstCommunes = await sql`SELECT * FROM communes LIMIT 5`;
            console.log("First 5 Communes:", firstCommunes);
        }

        const recentOrders = await sql`SELECT id, customer_id, status, created_at FROM orders ORDER BY created_at DESC LIMIT 5`;
        console.log("Recent Orders:", recentOrders);

    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        sql.end();
    }
}

checkLocations();
