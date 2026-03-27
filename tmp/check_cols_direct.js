const postgres = require('postgres');
const connectionString = "postgresql://postgres.qjzwlzdjaingtqlcjemi:Oo123456789..5656@aws-1-eu-west-1.pooler.supabase.com:5432/postgres";
const sql = postgres(connectionString);

async function main() {
    try {
        const res = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'orders'`;
        console.log('Columns:', res.map(r => r.column_name));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
