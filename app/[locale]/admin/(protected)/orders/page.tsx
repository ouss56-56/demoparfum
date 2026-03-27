import { sql } from "@/lib/db";
import OrderClientView from "@/components/admin/OrderClientView";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "admin.orders" });

    try {
        const ordersData = await sql`
            SELECT 
                o.*,
                (SELECT row_to_json(c) FROM customers c WHERE c.id = o.customer_id) as customers,
                (
                    SELECT json_agg(json_build_object(
                        'id', oi.id,
                        'product_id', oi.product_id,
                        'quantity', oi.quantity,
                        'price', oi.price,
                        'volume_id', oi.volume_id,
                        'volume_data', oi.volume_data,
                        'weight', oi.weight,
                        'product', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
                    ))
                    FROM order_items oi WHERE oi.order_id = o.id
                ) as items
            FROM orders o
            ORDER BY o.created_at DESC
        `;

        const serializedOrders = (ordersData || []).map((o: any) => ({
            id: o.id,
            customerId: o.customer_id,
            customer: {
                id: o.customer_id,
                shopName: o.customers?.shop_name || "",
                name: o.customers?.name || "",
                phone: o.customers?.phone || "",
                wilaya: o.wilaya_name ? `${o.wilaya_number || ''} - ${o.wilaya_name}` : (o.customers?.wilaya || ""),
                address: o.customers?.address || "",
            },
            shopName: o.customers?.shop_name || "",
            status: o.status,
            totalPrice: Number(o.total_price || 0),
            amountPaid: Number(o.amount_paid || 0),
            paymentStatus: o.payment_status || "UNPAID",
            createdAt: o.created_at ? new Date(o.created_at).toISOString() : new Date().toISOString(),
            updatedAt: o.updated_at ? new Date(o.updated_at).toISOString() : (o.created_at ? new Date(o.created_at).toISOString() : new Date().toISOString()),
            items: (o.items || []).map((i: any) => {
                const product = i.product ? {
                    id: i.product.id,
                    name: i.product.name,
                    brand: i.product.brand,
                    imageUrl: i.product.image_url,
                    basePrice: Number(i.product.base_price || 0)
                } : null;

                return {
                    id: i.id,
                    productId: i.product_id,
                    quantity: Number(i.quantity),
                    price: Number(i.price),
                    volumeId: i.volume_id,
                    volume: i.volume_data,
                    weight: Number(i.weight || 0),
                    product
                };
            }),
            invoice: o.invoice || null,
            shippingAddress: o.shipping_address,
            notes: o.notes
        }));

        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-serif font-bold text-primary-dark tracking-tight">{t("title")}</h1>
                        <p className="text-gray-500 mt-1 tracking-wide">{t("subtitle")}</p>
                    </div>
                </div>

                <OrderClientView orders={serializedOrders} />
            </div>
        );
    } catch (err) {
        console.error("Orders fetch error:", err);
        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-primary-dark tracking-tight">{t("title")}</h1>
                    <p className="text-gray-500 mt-1 tracking-wide">{t("subtitle")}</p>
                </div>
                <OrderClientView orders={[]} />
            </div>
        );
    }
}
