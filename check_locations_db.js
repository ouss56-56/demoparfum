const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    console.error('DATABASE_URL is missing');
    process.exit(1);
}

const sql = postgres(dbUrl, {
    ssl: 'require',
});

async function checkDB() {
    try {
        console.log('Checking wilayas table...');
        const wilayas = await sql`SELECT count(*) FROM wilayas`;
        console.log(`Total wilayas: ${wilayas[0].count}`);

        if (wilayas[0].count > 0) {
            const firstWilaya = await sql`SELECT * FROM wilayas LIMIT 1`;
            console.log('Sample wilaya:', firstWilaya[0]);
        }

        console.log('\nChecking communes table...');
        const communes = await sql`SELECT count(*) FROM communes`;
        console.log(`Total communes: ${communes[0].count}`);

        if (communes[0].count > 0) {
            const firstCommune = await sql`SELECT * FROM communes LIMIT 1`;
            console.log('Sample commune:', firstCommune[0]);
            
            const randomWilayaCode = firstCommune[0].wilaya_code;
            console.log(`\nChecking communes for wilaya_code ${randomWilayaCode}...`);
            const communesForWilaya = await sql`SELECT count(*) FROM communes WHERE wilaya_code = ${randomWilayaCode}`;
            console.log(`Communes for ${randomWilayaCode}: ${communesForWilaya[0].count}`);
        }

    } catch (err) {
        console.error('DB Error:', err);
    } finally {
        await sql.end();
    }
}

checkDB();
