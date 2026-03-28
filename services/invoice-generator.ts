import { sql } from "@/lib/db";

export const generateInvoice = async (orderId: string, customerId: string, amount: number) => {
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

    // Use a transaction to ensure both updates succeed
    await sql.begin(async (sql) => {
        await sql`
            INSERT INTO invoices (invoice_number, order_id, customer_id, total_amount, issue_date, status)
            VALUES (${invoiceNumber}, ${orderId}, ${customerId}, ${amount}, ${date.toISOString()}, 'UNPAID')
        `;
        
        await sql`
            UPDATE orders 
            SET invoice = ${sql.json(invoiceData)}
            WHERE id = ${orderId}
        `;
    });

    return { invoiceNumber, ...invoiceData };
};

export const getInvoicesByCustomer = async (customerId: string) => {
    return await sql`
        SELECT i.*, o.status as order_status
        FROM invoices i
        JOIN orders o ON i.order_id = o.id
        WHERE i.customer_id = ${customerId}
        ORDER BY i.issue_date DESC
    `;
};

export const getAdminInvoices = async () => {
    return await sql`
        SELECT i.*, c.shop_name, c.name as customer_name
        FROM invoices i
        LEFT JOIN customers c ON i.customer_id = c.id
        ORDER BY i.issue_date DESC
    `;
};
