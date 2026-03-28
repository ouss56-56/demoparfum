const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

// 1. Load DB URL
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const dbUrlMatch = envContent.match(/DATABASE_URL=["']?(.+?)["']?(\s|$)/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : null;

if (!dbUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
}

const sql = postgres(dbUrl, { ssl: 'require' });

// 2. Load and Parse Locations Data
const locationsPath = path.join(__dirname, '..', 'data', 'algeria-locations.ts');
let locationsContent = fs.readFileSync(locationsPath, 'utf8');

// Skip the 'export const algeriaLocations: WilayaData[] = ' part
const dataStartIndex = locationsContent.indexOf('= [') + 2;
const dataEndIndex = locationsContent.lastIndexOf(']') + 1;
let jsonStr = locationsContent.substring(dataStartIndex, dataEndIndex);

// Remove any trailing commas that might break JSON.parse
jsonStr = jsonStr.replace(/,\s*\]/g, ']');
jsonStr = jsonStr.replace(/,\s*\}/g, '}');

let locations;
try {
    locations = JSON.parse(jsonStr);
} catch (err) {
    console.error('Failed to parse locations JSON:', err.message);
    // Fallback: If JSON.parse fails, it might be the unquoted keys or similar.
    // For now, let's assume it works because the file looked like JSON.
    process.exit(1);
}

async function seed() {
    try {
        console.log(`Starting seed with ${locations.length} wilayas...`);

        // 1. Sync Wilayas
        for (const w of locations) {
            const code = String(w.id).padStart(2, '0');
            await sql`
                INSERT INTO wilayas (code, name)
                VALUES (${code}, ${w.name})
                ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
            `;
        }
        console.log('Wilayas synced successfully.');

        // 2. Sync Communes
        console.log('Preparing batch insert for communes...');
        
        await sql`TRUNCATE TABLE communes CASCADE`;

        const allCommunes = [];
        for (const w of locations) {
            const code = String(w.id).padStart(2, '0');
            for (const name of w.communes) {
                allCommunes.push({ wilaya_code: code, name });
            }
        }

        console.log(`Prepared ${allCommunes.length} communes for insertion.`);
        
        // Split into chunks of 500
        const chunkSize = 500;
        for (let i = 0; i < allCommunes.length; i += chunkSize) {
            const chunk = allCommunes.slice(i, i + chunkSize);
            console.log(`Inserting chunk ${Math.floor(i / chunkSize) + 1}...`);
            await sql`
                INSERT INTO communes ${sql(chunk, 'wilaya_code', 'name')}
            `;
        }
        
        console.log(`\nSuccessfully seeded ${allCommunes.length} communes in chunks!`);

    } catch (err) {
        console.error('Seed Error:', err);
    } finally {
        await sql.end();
    }
}

seed();
