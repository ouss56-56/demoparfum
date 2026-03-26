import postgres from 'postgres';

const DATABASE_URL = "postgresql://postgres.qjzwlzdjaingtqlcjemi:Oo123456789..5656@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function findJunctions() {
  try {
    const res = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%product%'
    `;
    console.log('--- PRODUCT RELATED TABLES ---');
    console.log(res.map(t => t.table_name).join(', '));
    
    // Also check for category/brand/collection associations
    const res2 = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%assoc%' OR table_name LIKE '%map%')
    `;
     console.log('--- ASSOC TABLES ---');
    console.log(res2.map(t => t.table_name).join(', '));

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

findJunctions();
