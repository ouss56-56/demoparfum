const postgres = require('postgres');
const fs = require('fs');

const sql = postgres('postgresql://postgres.qjzwlzdjaingtqlcjemi:Oo123456789..5656@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true', {
  ssl: 'require',
});

async function runFullFile(filePath) {
    console.log(`--- Running ${filePath} as single block ---`);
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    try {
        await sql.unsafe(content);
        console.log(`Success: ${filePath}`);
    } catch (err) {
        console.error(`Error in ${filePath}:`, err.message);
    }
}

async function fixCommunes() {
    console.log("--- Fixing Communes Data ---");
    const v58Content = fs.readFileSync('v58_communes_seed.sql', 'utf8');
    const lines = v58Content.split('\n');
    const transformedLines = [];
    
    for (let line of lines) {
        const match = line.match(/\((\d+),\s*'(.*)'\)/);
        if (match) {
            const id = parseInt(match[1]);
            const name = match[2].replace(/'/g, "''");
            const code = id.toString().padStart(2, '0');
            transformedLines.push(`('${code}', '${name}')`);
        }
    }
    
    if (transformedLines.length > 0) {
        await sql`TRUNCATE TABLE communes CASCADE`;
        const batchSize = 100;
        for (let i = 0; i < transformedLines.length; i += batchSize) {
            const batch = transformedLines.slice(i, i + batchSize);
            const query = `INSERT INTO communes (wilaya_code, name) VALUES ${batch.join(', ')}`;
            await sql.unsafe(query);
        }
        console.log(`Inserted ${transformedLines.length} communes`);
    }
}

async function main() {
    try {
        // Order matters! setup_algeria_locations defines the wilayas codes that communes depend on.
        await runFullFile('setup_algeria_locations.sql'); 
        await runFullFile('fix_all_platform.sql');
        await fixCommunes();
        
        const counts = {
            wilayas: (await sql`SELECT count(*) FROM wilayas`)[0].count,
            communes: (await sql`SELECT count(*) FROM communes`)[0].count
        };
        console.log("Final Counts:", counts);
    } catch (e) {
        console.error("Main Failed:", e);
    } finally {
        await sql.end();
    }
}

main();
