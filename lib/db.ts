import postgres from 'postgres';

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL is missing in environment variables.');
}

// Create the SQL client
// We use SSL 'require' for Supabase connections
export const sql = postgres(dbUrl || '', {
  ssl: 'require',
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
});

export default sql;
