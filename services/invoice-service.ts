import { sql } from "@/lib/db";

// ── GET ALL INVOICES (Admin) ─────────────────────────────────────────────
export const getInvoices = async () => {
    try {
        const data = await sql`
            SELECT 
                i.*,
                c.id as cust_id, c.shop_name, c.name as customer_name,
                o.status as order_status, o.total_price as order_total, 
                o.payment_status, o.amount_paid,
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
            totalAmount: Number(inv.total_amount || 0),
            status: inv.payment_status || inv.status || "UNPAID",
            amountPaid: Number(inv.amount_paid || 0),
            paymentStatus: inv.payment_status || "UNPAID",
            order: {
                id: inv.order_id,
                status: inv.order_status,
                totalPrice: Number(inv.order_total || 0),
                customer: {
                    id: inv.cust_id || inv.customer_id,
                    shopName: inv.shop_name || "Unknown",
                    name: inv.customer_name || ""
                },
                items: (inv.order_items || []).map((item: any) => ({
                    ...item,
                    volume: item.volume_data,
                    product: item.product
                }))
            }
        }));
    } catch (e) {
        console.error("getInvoices error, using JSONB fallback:", e);
        return getInvoicesFromJsonb();
    }
};

// ── FALLBACK: Get invoices from orders.invoice JSONB ─────────────────────
const getInvoicesFromJsonb = async () => {
    const data = await sql`
        SELECT 
            o.id, o.invoice, o.total_price, o.status, o.created_at, o.customer_id,
            o.payment_status, o.amount_paid,
            (SELECT row_to_json(c) FROM customers c WHERE c.id = o.customer_id) as customer_data
        FROM orders o
        WHERE o.invoice IS NOT NULL
        ORDER BY o.created_at DESC
    `;

    return (data || []).map((o: any) => ({
        id: o.id,
        orderId: o.id,
        invoiceNumber: o.invoice?.invoiceNumber || "N/A",
        issueDate: o.invoice?.issueDate ? new Date(o.invoice.issueDate) : new Date(o.created_at),
        totalAmount: Number(o.invoice?.totalAmount || o.total_price || 0),
        status: o.payment_status || "UNPAID",
        amountPaid: Number(o.amount_paid || 0),
        paymentStatus: o.payment_status || "UNPAID",
        order: {
            id: o.id,
            status: o.status,
            totalPrice: Number(o.total_price || 0),
            customer: {
                id: o.customer_id,
                shopName: o.customer_data?.shop_name || "Unknown",
                name: o.customer_data?.name || ""
            },
            items: []
        }
    }));
};

// ── GET INVOICE BY NUMBER ────────────────────────────────────────────────
export const getInvoiceById = async (invoiceNumber: string) => {
    try {
        const [data] = await sql`
            SELECT 
                i.*,
                c.id as cust_id, c.shop_name, c.name as customer_name, c.address, c.phone, c.wilaya,
                o.status as order_status, o.total_price as order_total,
                o.payment_status, o.amount_paid,
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
            totalAmount: Number(data.total_amount || 0),
            status: data.payment_status || data.status || "UNPAID",
            amountPaid: Number(data.amount_paid || 0),
            paymentStatus: data.payment_status || "UNPAID",
            order: {
                id: data.order_id,
                status: data.order_status,
                totalPrice: Number(data.order_total || 0),
                customer: {
                    id: data.cust_id || data.customer_id,
                    shopName: data.shop_name || "Unknown",
                    name: data.customer_name || "",
                    address: data.address || "",
                    phone: data.phone || "",
                    wilaya: data.wilaya || ""
                },
                items: (data.order_items || []).map((item: any) => ({
                    ...item,
                    volume: item.volume_data,
                    product: item.product
                }))
            }
        };
    } catch (e) {
        console.error("getInvoiceById table query failed:", e);
        return null;
    }
};

// ── GET INVOICE BY ORDER ID ──────────────────────────────────────────────
export const getInvoiceByOrderId = async (orderId: string) => {
    // Strategy 1: Look up in invoices table
    try {
        const [data] = await sql`
            SELECT invoice_number FROM invoices WHERE order_id = ${orderId} LIMIT 1
        `;
        if (data?.invoice_number) {
            return getInvoiceById(data.invoice_number);
        }
    } catch (e) {
        console.error("getInvoiceByOrderId table lookup failed:", e);
    }

    // Strategy 2: Look up from orders.invoice_number column
    try {
        const [order] = await sql`
            SELECT invoice_number, invoice, customer_id, total_price, status, created_at
            FROM orders WHERE id = ${orderId} LIMIT 1
        `;
        if (order?.invoice_number) {
            const result = await getInvoiceById(order.invoice_number);
            if (result) return result;
        }

        // Strategy 3: Construct from orders.invoice JSONB  
        if (order?.invoice?.invoiceNumber) {
            const [customer] = await sql`SELECT * FROM customers WHERE id = ${order.customer_id} LIMIT 1`;
            const orderItems = await sql`
                SELECT oi.*, 
                    (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id) as product
                FROM order_items oi WHERE oi.order_id = ${orderId}
            `;

            return {
                id: order.invoice.invoiceNumber,
                orderId,
                invoiceNumber: order.invoice.invoiceNumber,
                issueDate: order.invoice.issueDate ? new Date(order.invoice.issueDate) : new Date(order.created_at),
                totalAmount: Number(order.invoice.totalAmount || order.total_price || 0),
                status: order.payment_status || "UNPAID",
                amountPaid: Number(order.amount_paid || 0),
                paymentStatus: order.payment_status || "UNPAID",
                order: {
                    id: orderId,
                    status: order.status,
                    totalPrice: Number(order.total_price || 0),
                    customer: customer ? {
                        id: customer.id,
                        shopName: customer.shop_name || "Unknown",
                        name: customer.name || "",
                        address: customer.address || "",
                        phone: customer.phone || "",
                        wilaya: customer.wilaya || ""
                    } : { id: "", shopName: "Unknown", name: "", address: "", phone: "", wilaya: "" },
                    items: (orderItems || []).map((item: any) => ({
                        id: item.id,
                        product_id: item.product_id,
                        quantity: item.quantity,
                        price: item.price,
                        volume_data: item.volume_data,
                        volume: item.volume_data,
                        product: item.product
                    }))
                }
            };
        }
    } catch (e) {
        console.error("getInvoiceByOrderId JSONB fallback failed:", e);
    }

    return null;
};

// ── CREATE INVOICE (Proxy) ───────────────────────────────────────────────
export const createInvoice = async (orderId: string, amount: number) => {
    const { generateInvoice } = await import("./invoice-generator");
    const [order] = await sql`SELECT customer_id, total_price FROM orders WHERE id = ${orderId}`;
    if (!order) throw new Error("Order not found");
    const finalAmount = Number(amount) || Number(order.total_price) || 0;
    return generateInvoice(orderId, order.customer_id, finalAmount);
};
