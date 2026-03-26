import CollectionClientView from "@/components/admin/CollectionClientView";
import { getTranslations } from "next-intl/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "admin.collections" });

    const collectionsData = await sql`SELECT * FROM collections ORDER BY name ASC`;

    // Get product counts for each collection
    const collections = await Promise.all((collectionsData || []).map(async (col: any) => {
        const [countResult] = await sql`
            SELECT COUNT(*) as count FROM products WHERE ${col.id} = ANY(collection_ids)
        `;
        
        return { 
            ...col, 
            products: Array(Number(countResult?.count || 0)).fill({ id: '' })
        };
    }));

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-serif font-bold text-primary-dark tracking-tight">{t("title")}</h1>
                <p className="text-gray-500 mt-1 tracking-wide">{t("subtitle")}</p>
            </div>
            <CollectionClientView collections={collections} />
        </div>
    );
}
