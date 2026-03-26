import { sql } from "@/lib/db";
import { unstable_cache, revalidateTag } from "next/cache";

export interface Category {
    id: string;
    name: string;
    slug: string;
    description?: string;
    createdAt: Date;
    products?: any[];
}

function generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── READ (cached) ─────────────────────────────────────────────────────────
export const getCategories = () => {
    return unstable_cache(
        async () => {
            try {
                // Fetch categories and count products
                const categories = await sql`
                    SELECT c.*, 
                           (SELECT json_agg(json_build_object('id', p.id)) 
                            FROM products p WHERE p.category_id = c.id) as products
                    FROM categories c
                    ORDER BY c.name ASC
                `;

                return (categories || []).map(cat => ({
                    id: cat.id,
                    name: cat.name,
                    slug: cat.slug,
                    description: cat.description,
                    createdAt: new Date(cat.created_at),
                    products: cat.products || []
                }));
            } catch (err) {
                console.error("Categories fetch error (getCategories):", err);
                return [];
            }
        },
        ['categories-list'],
        { revalidate: 60, tags: ['categories'] }
    )();
};

export const getCategoryById = async (id: string) => {
    try {
        const [category] = await sql`SELECT * FROM categories WHERE id = ${id} LIMIT 1`;
        if (!category) return null;
        
        const products = await sql`
            SELECT * FROM products 
            WHERE category_id = ${id} AND status = 'ACTIVE'
            ORDER BY created_at DESC
        `;

        return { 
            id: category.id, 
            ...category, 
            createdAt: new Date(category.created_at),
            products: (products || []).map(p => ({
                ...p,
                createdAt: new Date(p.created_at),
                category: { id: category.id, name: category.name }
            }))
        };
    } catch (err) {
        console.error("Category fetch error (getCategoryById):", err);
        return null;
    }
};

export const getCategoryBySlug = async (slug: string) => {
    try {
        const [category] = await sql`SELECT * FROM categories WHERE slug = ${slug} LIMIT 1`;
        if (!category) return null;
        
        const products = await sql`
            SELECT * FROM products 
            WHERE category_id = ${category.id} AND status = 'ACTIVE'
            ORDER BY created_at DESC
        `;

        return { 
            ...category, 
            createdAt: new Date(category.created_at),
            products: (products || []).map(p => ({
                ...p,
                createdAt: new Date(p.created_at),
                category: { id: category.id, name: category.name }
            }))
        };
    } catch (err) {
        console.error("Category fetch error (getCategoryBySlug):", err);
        return null;
    }
};

// ── CREATE ────────────────────────────────────────────────────────────────
export const createCategory = async (data: {
    name: string;
    description?: string;
}) => {
    const slug = generateSlug(data.name);
    const [newCategory] = await sql`
        INSERT INTO categories (name, description, slug)
        VALUES (${data.name}, ${data.description || null}, ${slug})
        RETURNING *
    `;

    (revalidateTag as any)('categories');
    return { ...newCategory, id: newCategory.id };
};

// ── UPDATE ────────────────────────────────────────────────────────────────
export const updateCategory = async (
    id: string,
    data: Partial<{ name: string; description: string }>
) => {
    const slug = data.name ? generateSlug(data.name) : undefined;
    
    const [updatedCategory] = await sql`
        UPDATE categories 
        SET 
            name = ${data.name || null},
            description = ${data.description || null},
            slug = ${slug || null},
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
    `;

    (revalidateTag as any)('categories');
    return { ...updatedCategory, id: updatedCategory.id };
};

// ── DELETE ────────────────────────────────────────────────────────────────
export const deleteCategory = async (id: string) => {
    await sql`DELETE FROM categories WHERE id = ${id}`;
    (revalidateTag as any)('categories');
    return { id };
};
