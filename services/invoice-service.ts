import { sql } from "@/lib/db";

// ── READ ──────────────────────────────────────────────────────────────────
export const getInvoices = async () => {
    const data = await sql`
        SELECT 
            i.*,
            c.id as customer_id, c.shop_name, c.name as customer_name,
            o.status as order_status, o.total_price as order_total,
            (
                SELECT json_agg(json_build_object(
                    'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price', oi.price,
                    'volume_data', oi.volume_data,
                    'product', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
                ))
                FROM order_items oi WHERE oi.order_id = i.order_id
            ) as order_items
        FROM invoices i
        JOIN customers c ON i.customer_id = c.id
        JOIN orders o ON i.order_id = o.id
        ORDER BY i.issue_date DESC
    `;

    return (data || []).map((inv: any) => ({
        id: inv.invoice_number,
        orderId: inv.order_id,
        invoiceNumber: inv.invoice_number,
        issueDate: inv.issue_date ? new Date(inv.issue_date) : null,
        totalAmount: Number(inv.total_amount),
        status: inv.status,
        order: {
            id: inv.order_id,
            status: inv.order_status,
            totalPrice: Number(inv.order_total),
            customer: {
                id: inv.customer_id,
                shopName: inv.shop_name,
                name: inv.customer_name
            },
            items: (inv.order_items || []).map((item: any) => ({
                ...item,
                volume: item.volume_data,
                product: item.product
            }))
        }
    }));
};

export const getInvoiceById = async (invoiceNumber: string) => {
    const [data] = await sql`
        SELECT 
            i.*,
            c.id as customer_id, c.shop_name, c.name as customer_name, c.address, c.phone,
            o.status as order_status, o.total_price as order_total,
            (
                SELECT json_agg(json_build_object(
                    'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price', oi.price,
                    'volume_data', oi.volume_data,
                    'product', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
                ))
                FROM order_items oi WHERE oi.order_id = i.order_id
            ) as order_items
        FROM invoices i
        JOIN customers c ON i.customer_id = c.id
        JOIN orders o ON i.order_id = o.id
        WHERE i.invoice_number = ${invoiceNumber}
        LIMIT 1
    `;

    if (!data) return null;

    return {
        id: data.invoice_number,
        orderId: data.order_id,
        invoiceNumber: data.invoice_number,
        issueDate: data.issue_date ? new Date(data.issue_date) : null,
        totalAmount: Number(data.total_amount),
        status: data.status,
        order: {
            id: data.order_id,
            status: data.order_status,
            totalPrice: Number(data.order_total),
            customer: {
                id: data.customer_id,
                shopName: data.shop_name,
                name: data.customer_name,
                address: data.address,
                phone: data.phone
            },
            items: (data.order_items || []).map((item: any) => ({
                ...item,
                volume: item.volume_data,
                product: item.product
            }))
        }
    };
};

export const getInvoiceByOrderId = async (orderId: string) => {
    const [data] = await sql`
        SELECT i.* FROM invoices i WHERE i.order_id = ${orderId} LIMIT 1
    `;
    if (!data) return null;
    return getInvoiceById(data.invoice_number);
};

export const createInvoice = async (orderId: string, amount: number) => {
   // Proxy to generator
   const { generateInvoice } = await import("./invoice-generator");
   const [order] = await sql`SELECT customer_id FROM orders WHERE id = ${orderId}`;
   if (!order) throw new Error("Order not found");
   return generateInvoice(orderId, order.customer_id, amount);
};
