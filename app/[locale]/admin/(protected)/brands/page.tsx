import BrandClientView from "@/components/admin/BrandClientView";
import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "admin.brands" });

    const brandsData = await sql`SELECT * FROM brands ORDER BY name ASC`;

    // Get product counts per brand name
    const productCounts = await sql`
        SELECT brand, COUNT(*) as count FROM products WHERE brand IS NOT NULL GROUP BY brand
    `;

    const counts: Record<string, number> = {};
    (productCounts || []).forEach((p: any) => {
        if (p.brand) {
            counts[p.brand] = Number(p.count || 0);
        }
    });

    const brands = (brandsData || []).map((brand: any) => ({
        ...brand,
        _count: { products: counts[brand.name] || 0 }
    }));

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-primary-dark tracking-tight">{t("title")}</h1>
                    <p className="text-gray-500 mt-1 tracking-wide">{t("subtitle")}</p>
                </div>
            </div>

            <BrandClientView brands={brands} />
        </div>
    );
}
