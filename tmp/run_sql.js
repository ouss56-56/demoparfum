const postgres = require('postgres');
const fs = require('fs');

const sql = postgres('postgresql://postgres.qjzwlzdjaingtqlcjemi:Oo123456789..5656@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true', {
  ssl: 'require',
});

async function runSqlFile(filePath) {
    try {
        console.log(`Executing ${filePath}...`);
        const content = fs.readFileSync(filePath, 'utf8');
        // Split by semicolon (naive, but usually works for these scripts)
        const commands = content.split(';').map(c => c.trim()).filter(c => c.length > 0);
        
        for (const cmd of commands) {
            try {
                await sql.unsafe(cmd);
            } catch (err) {
                console.warn(`Warning in command: ${cmd.substring(0, 50)}...`, err.message);
            }
        }
        console.log(`Finished ${filePath}`);
    } catch (e) {
        console.error(`Error running ${filePath}:`, e);
    }
}

async function main() {
    await runSqlFile('fix_all_platform.sql');
    await runSqlFile('setup_algeria_locations.sql'); // To ensure tables exist
    await sql.end();
}

main();
