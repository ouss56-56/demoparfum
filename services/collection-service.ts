import { sql } from "@/lib/db";
import { unstable_cache, revalidateTag } from "next/cache";

function generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── READ (cached) ─────────────────────────────────────────────────────────
export const getCollections = () => {
    return unstable_cache(
        async () => {
            try {
                const collections = await sql`
                    SELECT c.*, 
                           (SELECT json_agg(json_build_object('id', p.id)) 
                            FROM products p WHERE c.id = ANY(p.collection_ids)) as products
                    FROM collections c
                    ORDER BY c.name ASC
                `;

                return (collections || []).map(c => ({
                    id: c.id,
                    name: c.name,
                    slug: c.slug,
                    createdAt: new Date(c.created_at),
                    products: c.products || []
                }));
            } catch (err) {
                console.error("Collections fetch error (getCollections):", err);
                return [];
            }
        },
        ['collections-list'],
        { revalidate: 60, tags: ['collections'] }
    )();
};

export const getCollectionBySlug = async (slug: string) => {
    try {
        const [collection] = await sql`SELECT * FROM collections WHERE slug = ${slug} LIMIT 1`;
        if (!collection) return null;

        const products = await sql`
            SELECT p.*, c.id as cat_id, c.name as cat_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE ${collection.id} = ANY(p.collection_ids) AND p.status = 'ACTIVE'
        `;

        const mappedProducts = (products || []).map(p => ({
            product: {
                id: p.id,
                ...p,
                createdAt: new Date(p.created_at),
                category: p.cat_id ? { id: p.cat_id, name: p.cat_name } : null
            }
        }));

        return { ...collection, products: mappedProducts };
    } catch (err) {
        console.error("Collection fetch error (getCollectionBySlug):", err);
        return null;
    }
};

// ── CREATE ────────────────────────────────────────────────────────────────
export const createCollection = async (data: { name: string }) => {
    const slug = generateSlug(data.name);
    const [newColl] = await sql`
        INSERT INTO collections (name, slug)
        VALUES (${data.name}, ${slug})
        RETURNING *
    `;

    (revalidateTag as any)('collections');
    return { ...newColl, id: newColl.id };
};

// ── UPDATE ────────────────────────────────────────────────────────────────
export const updateCollection = async (id: string, data: { name: string }) => {
    const slug = generateSlug(data.name);
    const [updated] = await sql`
        UPDATE collections 
        SET name = ${data.name}, slug = ${slug}
        WHERE id = ${id}
        RETURNING *
    `;

    (revalidateTag as any)('collections');
    return { ...updated, id: updated.id };
};

// ── DELETE ────────────────────────────────────────────────────────────────
export const deleteCollection = async (id: string) => {
    await sql`DELETE FROM collections WHERE id = ${id}`;
    (revalidateTag as any)('collections');
    return { id };
};
