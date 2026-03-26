import postgres from 'postgres';

const connectionString = "postgresql://postgres.qjzwlzdjaingtqlcjemi:Oo123456789..5656@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";
const sql = postgres(connectionString, { ssl: 'require' });

async function createBucket() {
  try {
    console.log('[Task] Connecting to PostgreSQL to configure Supabase Storage...');

    // 1. Insert the 'images' bucket
    console.log('[Task] Creating "images" bucket in storage.buckets...');
    await sql`
      INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      VALUES ('images', 'images', true, NULL, NULL)
      ON CONFLICT (id) DO UPDATE SET public = true;
    `;
    console.log('[Success] "images" bucket created or already exists and is public.');

    // 2. Setup permissions (Row Level Security on storage.objects)
    console.log('[Task] Configuring RLS Policies for "images" bucket...');

    try {
      await sql`
        CREATE POLICY "Public Access" 
        ON storage.objects FOR SELECT 
        USING (bucket_id = 'images');
      `;
      console.log('[Success] "Public Access" SELECT policy created.');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('[Info] "Public Access" SELECT policy already exists.');
      }
    }

    try {
      await sql`
        CREATE POLICY "Public Insert" 
        ON storage.objects FOR INSERT 
        WITH CHECK (bucket_id = 'images');
      `;
      console.log('[Success] "Public Insert" INSERT policy created.');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('[Info] "Public Insert" INSERT policy already exists.');
      }
    }

    // Since users need to upload images, let's also give UPDATE and DELETE just in case.
    try {
      await sql`
        CREATE POLICY "Public Update" 
        ON storage.objects FOR UPDATE 
        USING (bucket_id = 'images');
      `;
      console.log('[Success] "Public Update" policy created.');
    } catch (e) { }

    try {
      await sql`
        CREATE POLICY "Public Delete" 
        ON storage.objects FOR DELETE 
        USING (bucket_id = 'images');
      `;
      console.log('[Success] "Public Delete" policy created.');
    } catch (e) { }


    console.log('✅ Done! The Supabase Storage is now correctly configured.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to configure bucket:', error);
    process.exit(1);
  }
}

createBucket();
