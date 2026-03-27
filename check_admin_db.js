const postgres = require('postgres');

const sql = postgres("postgresql://postgres.qjzwlzdjaingtqlcjemi:Oo123456789..5656@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true", {
  ssl: 'require',
});

async function checkAdmin() {
    try {
        const [admin] = await sql`SELECT * FROM admins WHERE email = 'admin@gmail.com'`;
        console.log("Admin record found in DB:");
        console.log(admin);

        const bcrypt = require('bcryptjs');
        if (admin && admin.password_hash) {
            const isValid = await bcrypt.compare('123456', admin.password_hash);
            console.log("Password '123456' valid?", isValid);
        }
    } catch (e) {
        console.error("DB Error:", e);
    } finally {
        sql.end();
    }
}

checkAdmin();
