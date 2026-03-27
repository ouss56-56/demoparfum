import { sql } from './lib/db.ts';

async function main() {
    try {
        const res = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'order_items'`;
        console.log('Columns:', res.map(r => r.column_name));
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
