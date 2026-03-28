const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?(.+?)["']?(\s|$)/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : null;

if (!dbUrl) {
    console.error('DATABASE_URL not found in .env.local');
    process.exit(1);
}

const sql = postgres(dbUrl, {
    ssl: 'require',
});

async function checkDB() {
    try {
        console.log('--- Database Schema Check ---');
        
        // Check wilayas columns
        const wilayaCols = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'wilayas'
        `;
        console.log('Wilayas columns:', wilayaCols.map(c => `${c.column_name} (${c.data_type})`));

        // Check communes columns
        const communeCols = await sql`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'communes'
        `;
        console.log('Communes columns:', communeCols.map(c => `${c.column_name} (${c.data_type})`));

        console.log('\n--- Data Check ---');
        const wilayas = await sql`SELECT count(*) FROM wilayas`;
        console.log(`Total wilayas: ${wilayas[0].count}`);

        const communes = await sql`SELECT count(*) FROM communes`;
        console.log(`Total communes: ${communes[0].count}`);

        if (communes[0].count > 0) {
            const sampleCommune = await sql`SELECT * FROM communes LIMIT 1`;
            console.log('Sample commune:', sampleCommune[0]);
        }

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await sql.end();
    }
}

checkDB();
