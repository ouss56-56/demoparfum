import { sql } from "@/lib/db";

// ── GENERATE INVOICE ─────────────────────────────────────────────────────
export const generateInvoice = async (orderId: string, customerId: string, amount: number) => {
    // 1. Validate order exists
    const [order] = await sql`SELECT id, customer_id, total_price, invoice_number FROM orders WHERE id = ${orderId} LIMIT 1`;
    if (!order) {
        throw new Error(`Invoice generation failed: Order ${orderId} not found`);
    }

    // 2. Skip if invoice already exists for this order
    if (order.invoice_number) {
        console.log(`Invoice already exists for order ${orderId}: ${order.invoice_number}`);
        return { invoiceNumber: order.invoice_number, issueDate: new Date().toISOString(), totalAmount: amount };
    }

    // Also check invoices table
    const [existingInvoice] = await sql`SELECT invoice_number FROM invoices WHERE order_id = ${orderId} LIMIT 1`;
    if (existingInvoice) {
        console.log(`Invoice already exists in invoices table for order ${orderId}: ${existingInvoice.invoice_number}`);
        // Sync to orders table
        await sql`UPDATE orders SET invoice_number = ${existingInvoice.invoice_number} WHERE id = ${orderId}`.catch(() => {});
        return { invoiceNumber: existingInvoice.invoice_number, issueDate: new Date().toISOString(), totalAmount: amount };
    }

    // 3. Calculate total from order items if amount is 0 or invalid
    let finalAmount = Number(amount);
    if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0) {
        const totalFromOrder = Number(order.total_price);
        if (totalFromOrder > 0) {
            finalAmount = totalFromOrder;
        } else {
            // Fallback: calculate from order_items
            const [itemsTotal] = await sql`
                SELECT COALESCE(SUM(price * quantity), 0) as total 
                FROM order_items WHERE order_id = ${orderId}
            `;
            finalAmount = Number(itemsTotal?.total) || 0;
        }
    }

    // Use provided customerId or fall back to order's customer_id
    const finalCustomerId = customerId || order.customer_id;

    // 4. Generate unique invoice number
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${year}${month}-${random}`;

    const invoiceData = {
        invoiceNumber,
        issueDate: date.toISOString(),
        totalAmount: finalAmount
    };

    // 5. Write to BOTH storage locations (non-transactional for resilience)
    
    // 5a. Write to invoices table
    try {
        await sql`
            INSERT INTO invoices (invoice_number, order_id, customer_id, total_amount, issue_date, status)
            VALUES (${invoiceNumber}, ${orderId}, ${finalCustomerId}, ${finalAmount}, ${date.toISOString()}, 'UNPAID')
        `;
    } catch (e: any) {
        // If invoices table doesn't exist or FK fails, log but continue
        console.error("Invoice table insert failed (non-critical):", e?.message || e);
    }

    // 5b. Update orders table with invoice JSONB and invoice_number
    try {
        await sql`
            UPDATE orders 
            SET invoice = ${sql.json(invoiceData)},
                invoice_number = ${invoiceNumber}
            WHERE id = ${orderId}
        `;
    } catch (e: any) {
        console.error("Order invoice update failed:", e?.message || e);
        throw new Error(`Failed to save invoice data for order ${orderId}: ${e?.message}`);
    }

    return { ...invoiceData };
};

// ── GET INVOICES BY CUSTOMER ─────────────────────────────────────────────
export const getInvoicesByCustomer = async (customerId: string) => {
    try {
        // Try invoices table first
        const data = await sql`
            SELECT i.*, o.status as order_status, o.total_price
            FROM invoices i
            JOIN orders o ON i.order_id = o.id
            WHERE i.customer_id = ${customerId}
            ORDER BY i.issue_date DESC
        `;
        if (data && data.length > 0) return data;
    } catch (e) {
        // If invoices table doesn't exist, fall through to JSONB
        console.error("getInvoicesByCustomer table query failed, using JSONB fallback:", e);
    }

    // Fallback: read from orders.invoice JSONB
    const orders = await sql`
        SELECT id, invoice, total_price, status, created_at
        FROM orders 
        WHERE customer_id = ${customerId} AND invoice IS NOT NULL
        ORDER BY created_at DESC
    `;

    return (orders || []).map((o: any) => ({
        invoice_number: o.invoice?.invoiceNumber,
        order_id: o.id,
        customer_id: customerId,
        total_amount: o.invoice?.totalAmount || o.total_price,
        issue_date: o.invoice?.issueDate || o.created_at,
        status: 'UNPAID',
        order_status: o.status
    }));
};

// ── GET ADMIN INVOICES ───────────────────────────────────────────────────
export const getAdminInvoices = async () => {
    try {
        return await sql`
            SELECT i.*, c.shop_name, c.name as customer_name
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.id
            ORDER BY i.issue_date DESC
        `;
    } catch (e) {
        console.error("getAdminInvoices table query failed:", e);
        return [];
    }
};
