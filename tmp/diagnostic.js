const postgres = require('postgres');

const sql = postgres('postgresql://postgres.qjzwlzdjaingtqlcjemi:Oo123456789..5656@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true', {
  ssl: 'require',
});

async function diagnostic() {
    try {
        console.log("--- DIAGNOSTIC START ---");
        
        const tables = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
        console.log("Tables:", tables.map(t => t.tablename).join(', '));

        const counts = {
            wilayas: (await sql`SELECT count(*) FROM wilayas`)[0].count,
            communes: (await sql`SELECT count(*) FROM communes`)[0].count,
            orders: (await sql`SELECT count(*) FROM orders`)[0].count,
            customers: (await sql`SELECT count(*) FROM customers`)[0].count,
            products: (await sql`SELECT count(*) FROM products`)[0].count
        };
        console.log("Counts:", counts);

        if (counts.orders > 0) {
            const sampleOrder = await sql`SELECT id, customer_id, total_price, status FROM orders LIMIT 1`;
            console.log("Sample Order:", sampleOrder[0]);
            
            const customerOfOrder = await sql`SELECT id, name, shop_name FROM customers WHERE id = ${sampleOrder[0].customer_id}`;
            console.log("Customer of Sample Order:", customerOfOrder[0] || "NOT FOUND");
        }

        const communeSchema = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'communes'`;
        console.log("Communes Schema:", communeSchema.map(c => `${c.column_name}(${c.data_type})`).join(', '));

        const sampleCommunes = await sql`SELECT * FROM communes LIMIT 5`;
        console.log("Sample Communes:", sampleCommunes);

        console.log("--- DIAGNOSTIC END ---");
    } catch (e) {
        console.error("Diagnostic Failed:", e);
    } finally {
        await sql.end();
    }
}

diagnostic();
