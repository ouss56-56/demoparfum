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
    
    // Add supplemental wilayas 59-69 from SQL setup
    const supplemental = [
        { id: "59", name: "Aflou", communes: ["Aflou", "Sebgag", "Sidi Bouzid"] },
        { id: "60", name: "El Abiodh Sidi Cheikh", communes: ["Ain El Orak", "Arbaouat", "Brezina", "El Abiodh Sidi Cheikh", "Krakda"] },
        { id: "61", name: "El Aricha", communes: ["El Aricha", "Sidi Djilali"] },
        { id: "62", name: "El Kantara", communes: ["Branis", "Djemorah", "El Kantara"] },
        { id: "63", name: "Barika", communes: ["Barika", "Bitam", "M’Doukel"] },
        { id: "64", name: "Bou Saâda", communes: ["Benamerou", "Bou Saâda", "El Hamel", "Oultem", "Sidi Ameur", "Tamsa"] },
        { id: "65", name: "Messaad", communes: ["Ain El Ibel", "Amourah", "Deldoul", "Guettara", "Messaad", "Selmana"] },
        { id: "66", name: "Aïn Oussera", communes: ["Ain Oussera", "Benhar", "Guernini", "Hassi Fedoul", "Sidi Ladjel"] },
        { id: "67", name: "Bir el-Ater", communes: ["Bir El Ater", "El Ogla El Malha"] },
        { id: "68", name: "Ksar Chellala", communes: ["Ksar Chellala", "Zmalet El Emir Abdelkader"] },
        { id: "69", name: "Ksar El Boukhari", communes: ["Ksar El Boukhari", "M’fatha", "Saneg"] }
    ];
    locations.push(...supplemental);
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
        
        // Disable statement timeout for this session to allow large ops
        await sql`SET statement_timeout = 0`;
        
        console.log('Cleaning up existing communes...');
        await sql`DELETE FROM communes`;

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
