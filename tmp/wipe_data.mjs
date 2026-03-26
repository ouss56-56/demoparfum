import postgres from 'postgres';

const DATABASE_URL = "postgresql://postgres.qjzwlzdjaingtqlcjemi:Oo123456789..5656@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function wipeData() {
  console.log("Starting data wipe...");
  try {
    // We clean in order of dependencies
    await sql`DELETE FROM order_items`;
    console.log("- Deleted order items");
    
    await sql`DELETE FROM orders`;
    console.log("- Deleted orders");
    
    await sql`DELETE FROM inventory_logs`;
    console.log("- Deleted inventory logs");
    
    await sql`DELETE FROM inventory_history`;
    console.log("- Deleted inventory history");
    
    await sql`DELETE FROM products`;
    console.log("- Deleted products");
    
    console.log("Data wipe completed successfully.");
  } catch (e) {
    console.error("Data wipe failed:", e);
  } finally {
    process.exit(0);
  }
}

wipeData();
