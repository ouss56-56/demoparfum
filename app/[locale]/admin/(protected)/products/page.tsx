import { sql } from "@/lib/db";
import ProductClientView from "@/components/admin/ProductClientView";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "admin.products" });

    // Fetch data via direct SQL
    const [productsData, categories, brands, collections, tags] = await Promise.all([
        sql`SELECT p.*, c.name as category_name, b.name as brand_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN brands b ON p.brand_id = b.id
            ORDER BY p.created_at DESC`,
        sql`SELECT * FROM categories ORDER BY name ASC`,
        sql`SELECT * FROM brands ORDER BY name ASC`,
        sql`SELECT * FROM collections ORDER BY name ASC`,
        sql`SELECT * FROM tags ORDER BY name ASC`,
    ]);

    const serializedProducts = (productsData || []).map((p: any) => ({
        id: p.id,
        name: p.name || "",
        brand: p.brand || "",
        brandId: p.brand_id,
        slug: p.slug,
        description: p.description,
        categoryId: p.category_id,
        imageUrl: p.image_url || p.image,
        basePrice: Number(p.base_price),
        stockWeight: Number(p.stock_weight || 0),
        lowStockThreshold: p.low_stock_threshold,
        status: p.status,
        createdAt: new Date(p.created_at),
        updatedAt: new Date(p.updated_at),
        category: p.category_name ? { id: p.category_id, name: p.category_name } : null,
        brandName: p.brand_name || p.brand,
        collections: (p.collection_ids || []).map((cid: string) => ({ collection: { id: cid } })),
        tags: (p.tag_ids || []).map((tid: string) => ({ tag: { id: tid } })),
        volumes: p.volumes || [],
        images: p.images || [],
    }));

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-primary-dark tracking-tight">{t("title")}</h1>
                    <p className="text-gray-500 mt-1 tracking-wide">{t("subtitle")}</p>
                </div>
            </div>

            <ProductClientView
                products={serializedProducts}
                categories={categories || []}
                brands={brands || []}
                collections={collections || []}
                tags={tags || []}
            />
        </div>
    );
}
