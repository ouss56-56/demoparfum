import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL || '', { ssl: 'require' });

async function checkDefinition() {
  try {
    const res = await sql`
      SELECT routine_definition 
      FROM information_schema.routines 
      WHERE routine_name = 'create_order'
    `;
    console.log('--- RPC DEFINITION ---');
    console.log(res[0]?.routine_definition);
    
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('--- TABLES ---');
    console.log(tables.map(t => t.table_name).join(', '));
    
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

checkDefinition();
