import CategoryClientView from "@/components/admin/CategoryClientView";
import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "admin.categories" });

    const categoriesData = await sql`
        SELECT c.*, 
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) as product_count
        FROM categories c
        ORDER BY c.name ASC
    `;

    const categories = (categoriesData || []).map((cat: any) => ({
        ...cat,
        _count: { products: Number(cat.product_count || 0) }
    }));

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-primary-dark tracking-tight">{t("title")}</h1>
                    <p className="text-gray-500 mt-1 tracking-wide">{t("subtitle")}</p>
                </div>
            </div>

            <CategoryClientView categories={categories} />
        </div>
    );
}
