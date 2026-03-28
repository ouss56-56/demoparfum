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

// Simplistic parsing: extract everything between the first [ and the last ]
// and clean it up to be valid JSON if needed (though it looks like valid JSON)
const jsonStartIndex = locationsContent.indexOf('[');
const jsonEndIndex = locationsContent.lastIndexOf(']') + 1;
let jsonStr = locationsContent.substring(jsonStartIndex, jsonEndIndex);

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
        // We'll do this in a batch or one by one. Given the volume, one by one is safer for simple scripts.
        console.log('Syncing communes (this may take a minute)...');
        
        // Let's clear existing communes first to ensure a clean state, 
        // OR just use ON CONFLICT if we had a unique constraint on (wilaya_code, name).
        // Since we want to FIX the missing data, TRUNCATE is cleaner if we're sure.
        await sql`TRUNCATE TABLE communes CASCADE`;

        let totalCommunes = 0;
        for (const w of locations) {
            const code = String(w.id).padStart(2, '0');
            const communePromises = w.communes.map(communeName => {
                return sql`
                    INSERT INTO communes (wilaya_code, name)
                    VALUES (${code}, ${communeName})
                `;
            });
            await Promise.all(communePromises);
            totalCommunes += w.communes.length;
            process.stdout.write(`.`); // Progress indicator
        }
        
        console.log(`\nSuccessfully seeded ${totalCommunes} communes!`);

    } catch (err) {
        console.error('Seed Error:', err);
    } finally {
        await sql.end();
    }
}

seed();
