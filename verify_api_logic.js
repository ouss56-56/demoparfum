const http = require('http');

async function testAPI() {
    const testWilayas = ['01', '05', '16', '69'];
    for (const id of testWilayas) {
        console.log(`Testing API for Wilaya ${id}...`);
        // We can't easily fetch from the running Next.js server here, 
        // but we can simulate the DB call that the API makes.
    }
}

// Actually, I'll just use a node script to hit the same DB logic as the API.
const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?(.+?)["']?(\s|$)/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : null;
const sql = postgres(dbUrl, { ssl: 'require' });

async function verifyAPI() {
    const testIds = ['01', '05', '16', '69'];
    for (const id of testIds) {
        const communes = await sql`
            SELECT count(*) FROM communes WHERE wilaya_code = ${id}
        `;
        console.log(`Wilaya ${id}: ${communes[0].count} communes found.`);
    }
    await sql.end();
}

verifyAPI();
