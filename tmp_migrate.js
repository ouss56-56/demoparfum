const postgres = require('postgres');

// Configuration from .env.local direct URL
const connectionString = 'postgresql://postgres.qjzwlzdjaingtqlcjemi:Oo123456789..5656@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

async function migrate() {
    const sql = postgres(connectionString, {
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log("--- Starting Production Database Migration ---");
        
        console.log("1. Adding 'wilaya_id' to 'customers' table...");
        await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS wilaya_id INTEGER`;
        
        console.log("2. Adding 'commune' to 'customers' table...");
        await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS commune TEXT`;
        
        console.log("3. Updating WhatsApp testing number...");
        // Check if settings exist first
        const [settings] = await sql`SELECT id FROM site_settings LIMIT 1`;
        if (settings) {
            await sql`
                UPDATE site_settings 
                SET whatsapp_number = '+213555000000' 
                WHERE id = ${settings.id}
            `;
            console.log("WhatsApp number updated.");
        } else {
            console.log("No site_settings found to update.");
        }

        console.log("--- Migration Completed Successfully ---");
    } catch (err) {
        console.error("!!! Migration Failed !!!");
        console.error(err);
        process.exit(1);
    } finally {
        await sql.end();
    }
}

migrate();
