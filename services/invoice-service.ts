import { sql } from "@/lib/db";

// ── READ ──────────────────────────────────────────────────────────────────
export const getInvoices = async () => {
    const data = await sql`
        SELECT 
            o.*,
            (SELECT row_to_json(c) FROM customers c WHERE c.id = o.customer_id) as customers,
            (
                SELECT json_agg(json_build_object(
                    'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price', oi.price,
                    'volume_id', oi.volume_id, 'volume_data', oi.volume_data,
                    'product', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
                ))
                FROM order_items oi WHERE oi.order_id = o.id
            ) as order_items
        FROM orders o
        WHERE o.invoice IS NOT NULL
        ORDER BY o.created_at DESC
    `;

    return (data || []).map((order: any) => ({
        id: order.invoice?.invoiceNumber || order.id,
        orderId: order.id,
        invoiceNumber: order.invoice?.invoiceNumber,
        issueDate: order.invoice?.issueDate ? new Date(order.invoice.issueDate) : null,
        totalAmount: order.invoice?.totalAmount,
        order: {
            id: order.id,
            ...order,
            customer: order.customers,
            items: (order.order_items || []).map((item: any) => ({
                ...item,
                volume: item.volume_data,
                volumeId: item.volume_data?.id,
                product: item.product
            }))
        }
    }));
};

export const getInvoiceById = async (id: string) => {
    const [data] = await sql`
        SELECT 
            o.*,
            (SELECT row_to_json(c) FROM customers c WHERE c.id = o.customer_id) as customers,
            (
                SELECT json_agg(json_build_object(
                    'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price', oi.price,
                    'volume_data', oi.volume_data,
                    'product', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
                ))
                FROM order_items oi WHERE oi.order_id = o.id
            ) as order_items
        FROM orders o
        WHERE o.invoice->>'invoiceNumber' = ${id}
        LIMIT 1
    `;

    if (!data) return null;

    return {
        id: data.invoice?.invoiceNumber || data.id,
        orderId: data.id,
        invoiceNumber: data.invoice?.invoiceNumber,
        issueDate: data.invoice?.issueDate ? new Date(data.invoice.issueDate) : null,
        totalAmount: data.invoice?.totalAmount,
        order: {
            id: data.id,
            ...data,
            customer: data.customers,
            items: (data.order_items || []).map((item: any) => ({
                ...item,
                volume: item.volume_data,
                volumeId: item.volume_data?.id,
                product: item.product
            }))
        }
    };
};

export const getInvoiceByOrderId = async (orderId: string) => {
    const [data] = await sql`
        SELECT 
            o.*,
            (SELECT row_to_json(c) FROM customers c WHERE c.id = o.customer_id) as customers,
            (
                SELECT json_agg(json_build_object(
                    'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price', oi.price,
                    'volume_data', oi.volume_data,
                    'product', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
                ))
                FROM order_items oi WHERE oi.order_id = o.id
            ) as order_items
        FROM orders o
        WHERE o.id = ${orderId}
        LIMIT 1
    `;

    if (!data || !data.invoice) return null;

    return {
        id: data.invoice.invoiceNumber || data.id,
        orderId: data.id,
        invoiceNumber: data.invoice.invoiceNumber,
        issueDate: data.invoice.issueDate ? new Date(data.invoice.issueDate) : null,
        totalAmount: data.invoice.totalAmount,
        order: {
            id: data.id,
            ...data,
            customer: data.customers,
            items: (data.order_items || []).map((item: any) => ({
                ...item,
                volume: item.volume_data,
                volumeId: item.volume_data?.id,
                product: item.product
            }))
        }
    };
};

// ── CREATE ────────────────────────────────────────────────────────────────
export const createInvoice = async (orderId: string, amount: number) => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${year}${month}-${random}`;
    
    const invoiceData = {
        invoiceNumber,
        issueDate: date.toISOString(),
        totalAmount: amount
    };

    const [updatedOrder] = await sql`
        UPDATE orders SET invoice = ${JSON.stringify(invoiceData)}::jsonb
        WHERE id = ${orderId}
        RETURNING *
    `;

    if (!updatedOrder) throw new Error("Failed to update order with invoice");

    return { 
        id: invoiceNumber, 
        orderId, 
        ...invoiceData 
    };
};
