import { sql } from "@/lib/db";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import InvoiceView from "@/components/shop/InvoiceView";

export const dynamic = "force-dynamic";

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string, locale: string }> }) {
    const { id, locale } = await params;
    
    // Fetch order with embedded invoice and customer details via direct SQL
    const [orderData] = await sql`
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
                    'product', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
                ))
                FROM order_items oi WHERE oi.order_id = o.id
            ) as items
        FROM orders o
        WHERE o.id = ${id}
        LIMIT 1
    `;
    
    if (!orderData || !orderData.invoice) {
        return <div className="p-8">Invoice not found.</div>;
    }

    const customer = orderData.customers || { shop_name: "Unknown", name: "", address: "", wilaya: "", phone: "" };

    const items: any[] = (orderData.items || []).map((item: any) => {
        const prod = item.product;
        return {
            id: item.product_id,
            quantity: item.quantity,
            price: item.price,
            volume: item.volume_data,
            volumeId: item.volume_data?.id,
            product: { 
                name: prod?.name || "Product", 
                brand: prod?.brand || "",
                imageUrl: prod?.image_url
            }
        };
    });

    const invoice = {
        invoiceNumber: orderData.invoice.invoiceNumber,
        issueDate: new Date(orderData.invoice.issueDate || orderData.created_at),
        totalAmount: orderData.invoice.totalAmount || orderData.total_price,
        orderId: id,
        order: { 
            customer: {
                shopName: customer.shop_name,
                name: customer.name,
                address: customer.address,
                wilaya: customer.wilaya,
                phone: customer.phone
            }, 
            items 
        },
    };

    return (
        <div className="min-h-screen bg-gray-50 print:bg-white p-4 sm:p-12">
            {/* Screen Header (Hidden on Print) */}
            <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between border-b border-gray-100 pb-4 print:hidden">
                <Link href={`/${locale}/admin/orders/${invoice.orderId}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors font-bold">
                    <ArrowLeft className="w-4 h-4" /> Back to Order
                </Link>
                <div className="flex gap-3">
                    <button
                        onMouseDown={() => window.print()}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary-dark text-white rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary transition-all active:scale-95"
                    >
                        <Printer className="w-4 h-4" /> Print Document
                    </button>
                </div>
            </div>

            {/* Print Content */}
            <InvoiceView invoice={invoice} locale={locale} />
        </div>
    );
}
