import { sql } from "@/lib/db";
import { unstable_cache, revalidateTag } from "next/cache";

// Core Product interface for the application
export interface Product {
    id: string;
    name: string;
    slug: string;
    brand: string;
    image: string;
    imageUrl: string;
    price: number;
    basePrice: number;
    stock: number;
    description: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    category: { id: string; name: string } | null;
    categoryId: string | null;
    images: any[];
    volumes: any[];
    tagIds: string[];
    collectionIds: string[];
}

// ── Utility ───────────────────────────────────────────────────────────────
function generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Product Mapping from Supabase structure
function mapProduct(data: any): Product {
    const imageUrl = data.image_url || data.image || "";
    const basePrice = Number(data.base_price || data.price || 0);

    return {
        id: data.id,
        name: data.name || "Unknown Product",
        slug: data.slug || "",
        brand: data.brand || "Demo",
        image: imageUrl,
        imageUrl: imageUrl, 
        price: basePrice,
        basePrice: basePrice,
        stock: data.stock_weight ?? data.stock ?? 0,
        description: data.description || "",
        status: data.status || "ACTIVE",
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        category: data.category_id ? { id: data.category_id, name: data.category_name || "" } : null,
        categoryId: data.category_id,
        images: (data.images || []).sort((a: any, b: any) => (a.position || 0) - (b.position || 0)),
        volumes: (data.volumes && data.volumes.length > 0) ? data.volumes : [
            { id: 'v100', weight: 100, price: basePrice * 1 },
            { id: 'v500', weight: 500, price: basePrice * 5 },
            { id: 'v1000', weight: 1000, price: basePrice * 10 }
        ],
        tagIds: data.tag_ids || [],
        collectionIds: data.collection_ids || [],
    };
}

// ── READ ──────────────────────────────────────────────────────────────────
export const getActiveProducts = (filters?: {
    categoryId?: string;
    brand?: string;
    search?: string;
    collectionSlug?: string;
    tagSlug?: string;
    inStock?: boolean;
    limit?: number;
    skip?: number;
}) => {
    const fetchFunc = async () => {
        try {
            let products = await sql`
                SELECT * FROM products 
                WHERE status = 'ACTIVE'
                ${filters?.categoryId ? sql`AND category_id = ${filters.categoryId}` : sql``}
                ${filters?.brand ? sql`AND brand = ${filters.brand}` : sql``}
                ${filters?.inStock ? sql`AND (stock > 0 OR stock_weight > 0)` : sql``}
                ORDER BY created_at DESC
            `;

            let mappedProducts = (products || []).map(mapProduct);

            if (filters?.search) {
                const s = filters.search.toLowerCase();
                mappedProducts = mappedProducts.filter((p: Product) => {
                    const searchable = `${p.name} ${p.brand} ${p.description} ${p.category?.name || ""}`.toLowerCase();
                    return s.split(/\s+/).every(term => searchable.includes(term));
                });
            }

            const total = mappedProducts.length;
            const skip = filters?.skip || 0;
            const limit = filters?.limit || 50;
            const paged = mappedProducts.slice(skip, skip + limit);

            return { products: paged, total };
        } catch (err) {
            console.error("Products fetch error (getActiveProducts):", err);
            return { products: [], total: 0 };
        }
    };

    const cacheKey = JSON.stringify(filters || {});
    return unstable_cache(
        fetchFunc,
        ['products', cacheKey],
        { revalidate: 60, tags: ['products'] }
    )();
};

export const getProducts = (filters?: {
    categoryId?: string;
    brand?: string;
    search?: string;
    status?: string;
    limit?: number;
}) => {
    const fetchFunc = async () => {
        try {
            let products = await sql`
                SELECT * FROM products
                WHERE 1=1
                ${filters?.categoryId ? sql`AND category_id = ${filters.categoryId}` : sql``}
                ${filters?.brand ? sql`AND brand = ${filters.brand}` : sql``}
                ${filters?.status ? sql`AND status = ${filters.status}` : sql``}
                ORDER BY created_at DESC
                ${filters?.limit ? sql`LIMIT ${filters.limit}` : sql``}
            `;

            let mappedProducts = (products || []).map(mapProduct);

            if (filters?.search) {
                const s = filters.search.toLowerCase();
                mappedProducts = mappedProducts.filter((p: Product) => {
                    const searchable = `${p.name} ${p.brand} ${p.description} ${p.category?.name || ""}`.toLowerCase();
                    return s.split(/\s+/).every(term => searchable.includes(term));
                });
            }

            return mappedProducts;
        } catch (err) {
            console.error("Products fetch error (getProducts):", err);
            return [];
        }
    };

    const cacheKey = JSON.stringify(filters || {});
    return unstable_cache(
        fetchFunc,
        ['admin-products', cacheKey],
        { tags: ['products'] }
    )();
};

export const getProductById = async (id: string) => {
    try {
        const [data] = await sql`SELECT * FROM products WHERE id = ${id} LIMIT 1`;
        if (!data) return null;
        return mapProduct(data);
    } catch (err) {
        console.error("Product fetch error (getProductById):", err);
        return null;
    }
};

export const getProductBySlug = async (slug: string) => {
    try {
        const [data] = await sql`SELECT * FROM products WHERE slug = ${slug} LIMIT 1`;
        if (!data) return null;
        return mapProduct(data);
    } catch (err) {
        console.error("Product fetch error (getProductBySlug):", err);
        return null;
    }
};

// ── Featured / New Arrivals / Best Sellers ────────────────────────────────
export const getFeaturedProducts = (limit = 8) => {
    return unstable_cache(
        async () => {
            try {
                const products = await sql`
                    SELECT p.* FROM products p
                    WHERE p.status = 'ACTIVE' 
                    AND EXISTS (
                        SELECT 1 FROM tags t 
                        WHERE t.id = ANY(p.tag_ids) 
                        AND t.slug = 'featured'
                    )
                    ORDER BY p.created_at DESC
                    LIMIT ${limit}
                `;
                // If it's pure UUIDs, we join
                /* 
                const products = await sql`
                    SELECT p.* FROM products p
                    JOIN tags t ON t.id = ANY(p.tag_ids)
                    WHERE p.status = 'ACTIVE' AND t.slug = 'featured'
                    ORDER BY p.created_at DESC
                    LIMIT ${limit}
                `;
                */
               
                // Fallback attempt: if tag_ids contains slugs directly or if we just want recent
                const fallback = await sql`
                    SELECT * FROM products 
                    WHERE status = 'ACTIVE'
                    ORDER BY created_at DESC
                    LIMIT ${limit}
                `;
                
                return (fallback || []).map(mapProduct);
            } catch (err) {
                console.error("Products fetch error (getFeaturedProducts):", err);
                return [];
            }
        },
        ['featured-products', String(limit)],
        { tags: ['products', 'featured'] }
    )();
};

export const getNewArrivals = (limit = 8) => {
    return unstable_cache(
        async () => {
            try {
                const products = await sql`
                    SELECT * FROM products 
                    WHERE status = 'ACTIVE'
                    ORDER BY created_at DESC
                    LIMIT ${limit}
                `;
                return (products || []).map(mapProduct);
            } catch (err) {
                console.error("Products fetch error (getNewArrivals):", err);
                return [];
            }
        },
        ['new-arrivals', String(limit)],
        { tags: ['products', 'new-arrivals'] }
    )();
};

export const getBestSellers = (limit = 8) => {
    return unstable_cache(
        async () => {
            try {
                const products = await sql`
                    SELECT * FROM products 
                    WHERE status = 'ACTIVE'
                    ORDER BY sales_units_sold DESC
                    LIMIT ${limit}
                `;
                return (products || []).map(mapProduct);
            } catch (err) {
                console.error("Products fetch error (getBestSellers):", err);
                return [];
            }
        },
        ['best-sellers', String(limit)],
        { tags: ['products', 'best-sellers'] }
    )();
};

// ── CREATE ────────────────────────────────────────────────────────────────
export const createProduct = async (data: any) => {
    const slug = generateSlug(data.name) + "-" + Date.now().toString(36);
    const images = (data.additionalImages || []).map((url: string, i: number) => ({
        imageUrl: url,
        isPrimary: i === 0 && !data.imageUrl,
        position: i
    }));
    const volumes = (data.volumes || []).map((v: any, i: number) => ({
        id: `vol-${Date.now()}-${i}`,
        weight: v.weight,
        price: v.price
    }));

    const [newProduct] = await sql`
        INSERT INTO products (
            name, brand, slug, description, category_id, image_url, base_price, stock, 
            low_stock_threshold, status, collection_ids, tag_ids, volumes, images, 
            sales_units_sold, sales_revenue
        ) VALUES (
            ${data.name}, ${data.brand}, ${slug}, ${data.description}, ${data.categoryId}, 
            ${data.imageUrl}, ${data.basePrice}, ${data.stock}, ${data.lowStockThreshold || 500}, 
            ${data.status || "ACTIVE"}, ${data.collectionIds || []}, ${data.tagIds || []}, 
            ${JSON.stringify(volumes)}::JSONB, ${JSON.stringify(images)}::JSONB, 0, 0
        )
        RETURNING *
    `;

    if (data.stock > 0) {
        await sql`
            INSERT INTO inventory_logs (product_id, change_type, quantity, source, reason)
            VALUES (${newProduct.id}, 'INITIAL_STOCK', ${data.stock}, 'ADMIN', 'Initial stock')
        `;
    }

    (revalidateTag as any)('products');
    (revalidateTag as any)('featured-products');
    (revalidateTag as any)('new-arrivals');
    (revalidateTag as any)('best-sellers');
    return mapProduct(newProduct);
};

export const updateProduct = async (id: string, data: any) => {
    const updateObj: any = { ...data, updated_at: new Date() };
    
    // Map names to snake_case
    if (data.imageUrl) { updateObj.image_url = data.imageUrl; delete updateObj.imageUrl; }
    if (data.basePrice !== undefined) { updateObj.base_price = data.basePrice; delete updateObj.basePrice; }
    if (data.categoryId) { updateObj.category_id = data.categoryId; delete updateObj.categoryId; }
    if (data.lowStockThreshold !== undefined) { updateObj.low_stock_threshold = data.lowStockThreshold; delete updateObj.lowStockThreshold; }
    if (data.collectionIds) { updateObj.collection_ids = data.collectionIds; delete updateObj.collectionIds; }
    if (data.tagIds) { updateObj.tag_ids = data.tagIds; delete updateObj.tagIds; }
    if (data.volumes) { updateObj.volumes = JSON.stringify(data.volumes); }

    const [updatedProduct] = await sql`
        UPDATE products SET ${sql(updateObj)}
        WHERE id = ${id}
        RETURNING *
    `;

    (revalidateTag as any)('products');
    return mapProduct(updatedProduct);
};

export const deleteProduct = async (id: string) => {
    await sql`DELETE FROM products WHERE id = ${id}`;
    (revalidateTag as any)('products');
    return { id };
};

export const getLowStockProducts = async () => {
    const data = await sql`
        SELECT * FROM products 
        WHERE stock <= 500 
        ORDER BY stock ASC
    `;
    return (data || []).map(mapProduct);
};

export const ProductService = {
    getActiveProducts,
    getProducts,
    getProductById,
    getProductBySlug,
    getFeaturedProducts,
    getNewArrivals,
    getBestSellers,
    createProduct,
    updateProduct,
    deleteProduct,
    getLowStockProducts
};
