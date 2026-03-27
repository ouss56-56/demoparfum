const postgres = require('postgres');
const fs = require('fs');

const sql = postgres('postgresql://postgres.qjzwlzdjaingtqlcjemi:Oo123456789..5656@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true', {
  ssl: 'require',
});

function splitSql(content) {
    const commands = [];
    let current = '';
    let inDollar = null; // Stored the dollar tag like '$$' or '$func$'
    
    const lines = content.split('\n');
    for (let line of lines) {
        // Simple check for dollar quoting
        const dollarMatch = line.match(/\$[a-zA-Z0-9_]*\$/);
        if (dollarMatch) {
            const tag = dollarMatch[0];
            if (!inDollar) {
                inDollar = tag;
            } else if (inDollar === tag) {
                inDollar = null;
            }
        }
        
        current += line + '\n';
        
        if (!inDollar && line.trim().endsWith(';')) {
            commands.push(current.trim());
            current = '';
        }
    }
    if (current.trim()) {
        commands.push(current.trim());
    }
    return commands;
}

async function runSqlFile(filePath) {
    console.log(`--- Processing ${filePath} ---`);
    if (!fs.existsSync(filePath)) {
        console.warn(`File ${filePath} not found`);
        return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const commands = splitSql(content);
    
    for (let cmd of commands) {
        const cleanCmd = cmd.trim();
        if (!cleanCmd || cleanCmd.startsWith('--')) continue;
        try {
            await sql.unsafe(cleanCmd);
            console.log(`Success: ${cleanCmd.substring(0, 50).replace(/\n/g, ' ')}...`);
        } catch (err) {
            if (err.message.includes('already exists') || err.message.includes('skipping')) {
                console.log(`Skipped: ${err.message}`);
            } else {
                console.error(`Error in command: ${cleanCmd.substring(0, 100)}...`, err.message);
            }
        }
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
        // Insert in batches of 200
        for (let i = 0; i < transformedLines.length; i += 200) {
            const batch = transformedLines.slice(i, i + 200);
            const query = `INSERT INTO communes (wilaya_code, name) VALUES ${batch.join(', ')}`;
            await sql.unsafe(query);
            console.log(`Inserted batch ${i/200 + 1}`);
        }
    }
}

async function verify() {
    console.log("--- FINAL VERIFICATION ---");
    const counts = {
        wilayas: (await sql`SELECT count(*) FROM wilayas`)[0].count,
        communes: (await sql`SELECT count(*) FROM communes`)[0].count,
        orders: (await sql`SELECT count(*) FROM orders`)[0].count
    };
    console.log("Final Counts:", counts);
    
    const rpcExists = await sql`SELECT has_function_privilege('postgres', 'create_order(UUID, JSONB, TEXT, TEXT, TEXT)', 'execute')`;
    console.log("RPC 'create_order' verified:", rpcExists[0].has_function_privilege);
}

async function main() {
    try {
        await runSqlFile('fix_all_platform.sql');
        await runSqlFile('setup_algeria_locations.sql');
        await fixCommunes();
        await verify();
        console.log("--- ALL UPDATES COMPLETED ---");
    } catch (e) {
        console.error("Main Failed:", e);
    } finally {
        await sql.end();
    }
}

main();
