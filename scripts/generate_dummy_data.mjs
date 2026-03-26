import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// WORKAROUND: If DNS resolution fails for 'aws-1-eu-west-1.pooler.supabase.com', 
// use a hardcoded IP (e.g. 54.247.26.119) or resolve using 8.8.8.8.
const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-') 
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '') 
        .replace(/-+$/, '');
}

async function generateData() {
    try {
        console.log("Starting Dummy Data Generation...");
        
        console.log("Wiping existing catalog products and orders to establish a clean slate...");
        await sql`DELETE FROM order_items`;
        await sql`DELETE FROM orders`;
        await sql`DELETE FROM inventory_logs`;
        await sql`DELETE FROM inventory_history`;
        await sql`DELETE FROM products`;

        // 1. Categories
        console.log("Generating 10 Categories...");
        const categoryIds = [];
        const categoryNames = ["Citrus", "Floral", "Woody", "Oriental", "Fruity", "Spicy", "Aquatic", "Gourmand", "Fresh", "Leather"];
        for (const name of categoryNames) {
            const slug = slugify(name);
            const [cat] = await sql`
                INSERT INTO categories (name, slug, description)
                VALUES (${name}, ${slug}, ${`Premium ${name} fragrances collection.`})
                ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
            `;
            categoryIds.push(cat.id);
        }

        // 2. Brands
        console.log("Generating 10 Brands...");
        const brandIds = [];
        const brandNames = ["Aura", "Lumina", "Velvet Essence", "Oud Master", "Noir", "Pure Breeze", "Royal Scent", "Eclipse", "Petal Drop", "Amber Glow"];
        for (const name of brandNames) {
            const slug = slugify(name);
            const [brand] = await sql`
                INSERT INTO brands (name, slug, description)
                VALUES (${name}, ${slug}, ${`Exclusive perfumes by ${name}.`})
                ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
            `;
            brandIds.push(brand.id);
        }

        // 3. Collections
        console.log("Generating 10 Collections...");
        const collectionIds = [];
        const collectionNames = ["Summer Essentials", "Winter Warmth", "Night Out", "Office Chic", "Signature Series", "Romance", "Adventure", "Heritage", "Midnight", "Sunrise"];
        for (const name of collectionNames) {
            const slug = slugify(name);
            const [col] = await sql`
                INSERT INTO collections (name, slug, description)
                VALUES (${name}, ${slug}, ${`A curated collection for ${name}.`})
                ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
            `;
            collectionIds.push(col.id);
        }

        // 4. Tags
        console.log("Generating 10 Tags...");
        const tagIds = [];
        const tagNames = ["Bestseller", "New Arrival", "Limited Edition", "Unisex", "For Him", "For Her", "Vegan", "Organic", "Luxury", "Everyday Use"];
        for (const name of tagNames) {
            const slug = slugify(name);
            const [tag] = await sql`
                INSERT INTO tags (name, slug)
                VALUES (${name}, ${slug})
                ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
                RETURNING id
            `;
            tagIds.push(tag.id);
        }

        // 5. Products
        console.log("Generating 10 Products...");
        const productNames = ["Citrus Burst", "Velvet Rose", "Dark Oud", "Ocean Breeze", "Vanilla Dream", "Spicy Amber", "Leather & Wood", "Midnight Jasmine", "Morning Dew", "Golden Saffron"];
        
        for (let i = 0; i < 10; i++) {
            const name = productNames[i];
            const slug = slugify(name) + "-" + Date.now().toString(36);
            const basePrice = Math.floor(Math.random() * 15000) + 5000;
            const purchasePrice = Math.floor(basePrice * 0.6);
            
            // Randomly select relations
            const categoryId = categoryIds[i % categoryIds.length];
            const brandId = brandIds[i % brandIds.length];
            const brandName = brandNames[i % brandNames.length];
            
            const prodCollectionIds = [collectionIds[i], collectionIds[(i + 1) % 10]];
            const prodTagIds = [tagIds[i], tagIds[(i + 2) % 10]];

            // Standard Volumes
            const volumes = [
                { id: 'v100', weight: 100, price: basePrice },
                { id: 'v500', weight: 500, price: basePrice * 4.5 },
                { id: 'v1000', weight: 1000, price: basePrice * 8 }
            ];

            await sql`
                INSERT INTO products (
                    name, brand, brand_id, slug, description, category_id, 
                    base_price, purchase_price, stock_weight, low_stock_threshold, 
                    status, collection_ids, tag_ids, volumes, images
                ) VALUES (
                    ${name}, ${brandName}, ${brandId}, ${slug}, ${`A fantastic new fragrance called ${name}.`}, ${categoryId}, 
                    ${basePrice}, ${purchasePrice}, 5000, 500, 
                    'ACTIVE', ${prodCollectionIds}, ${prodTagIds}, 
                    ${JSON.stringify(volumes)}::JSONB, '[]'::JSONB
                )
            `;
        }

        console.log("Successfully generated all dummy data!");
        process.exit(0);
    } catch (e) {
        console.error("Error generating dummy data:", e);
        process.exit(1);
    }
}

generateData();
