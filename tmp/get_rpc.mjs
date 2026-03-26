import postgres from 'postgres';

const DATABASE_URL = "postgresql://postgres.qjzwlzdjaingtqlcjemi:Oo123456789..5656@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

const sql = postgres(DATABASE_URL, { ssl: 'require' });

async function getFunctionBody() {
  try {
    const res = await sql`
      SELECT routine_definition 
      FROM information_schema.routines 
      WHERE routine_name = 'create_order'
    `;
    console.log('--- CREATE_ORDER RPC ---');
    console.log(res[0]?.routine_definition || "NOT FOUND");

  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

getFunctionBody();
