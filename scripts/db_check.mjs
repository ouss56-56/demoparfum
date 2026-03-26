import postgres from 'postgres';

const db_url = process.env.DATABASE_URL.replace('aws-1-eu-west-1.pooler.supabase.com', '54.247.26.119');
const sql = postgres(db_url, { ssl: { rejectUnauthorized: false } });

async function check() {
    try {
        const policies = await sql`SELECT * FROM pg_policies WHERE tablename = 'notifications'`;
        console.log("Notification Policies:", JSON.stringify(policies, null, 2));

        const rlsEnabled = await sql`SELECT relrowsecurity FROM pg_class WHERE relname = 'notifications'`;
        console.log("RLS Enabled:", rlsEnabled[0].relrowsecurity);

        const notifCount = await sql`SELECT count(*) FROM notifications WHERE type = 'ANNOUNCEMENT'`;
        console.log("Announcement Count:", notifCount[0].count);

        const notifs = await sql`SELECT * FROM notifications WHERE type = 'ANNOUNCEMENT' LIMIT 5`;
        console.log("Sample Announcements:", JSON.stringify(notifs, null, 2));

    } catch (e) {
        console.error("Check failed:", e);
    } finally {
        process.exit(0);
    }
}

check();
