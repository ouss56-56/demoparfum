const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?(.+?)["']?(\s|$)/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : null;

const sql = postgres(dbUrl, { ssl: 'require' });

async function checkDistribution() {
    try {
        const counts = await sql`
            SELECT wilaya_code, count(*) 
            FROM communes 
            GROUP BY wilaya_code 
            ORDER BY wilaya_code
        `;
        console.log('Communes per wilaya code:');
        console.table(counts);

        const wilayasWithoutCommunes = await sql`
            SELECT code, name 
            FROM wilayas 
            WHERE code NOT IN (SELECT DISTINCT wilaya_code FROM communes)
            ORDER BY code
        `;
        console.log('\nWilayas with NO communes:');
        console.table(wilayasWithoutCommunes);

    } catch (err) {
        console.error(err);
    } finally {
        await sql.end();
    }
}

checkDistribution();
