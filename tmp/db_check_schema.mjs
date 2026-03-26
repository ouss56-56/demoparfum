import postgres from 'postgres';

const DATABASE_URL = "postgresql://postgres.qjzwlzdjaingtqlcjemi:Oo123456789..5656@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function checkSchema() {
  try {
    const res = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'products'
    `;
    console.log('--- PRODUCTS SCHEMA ---');
    console.log(res.map(c => `${c.column_name}: ${c.data_type}`).join('\n'));

    const res2 = await sql`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    `;
    console.log('--- ALL TABLES ---');
    console.log(res2.map(t => t.table_name).join(', '));

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

checkSchema();
