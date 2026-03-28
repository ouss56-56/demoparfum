import { sql } from "@/lib/db";
import { generateInvoice } from "./invoice-generator";
import { createNotification } from "./notification-service";

export const handleStatusUpdate = async (orderId: string, newStatus: string, changedBy: string = "ADMIN", note?: string) => {
    const [order] = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
    if (!order) throw new Error("Order not found");

    const oldStatus = order.status;
    
    // Logic for Stock Return on Cancellation
    if (newStatus === "CANCELLED" && oldStatus !== "CANCELLED") {
        await sql`
            UPDATE products p
            SET stock_weight = stock_weight + (oi.quantity * (oi.volume_data->>'weight')::NUMERIC)
            FROM order_items oi
            WHERE oi.order_id = ${orderId} AND oi.product_id = p.id
        `;
    }

    // Logic for Invoice Generation on Shipped/Delivered
    if ((newStatus === "SHIPPED" || newStatus === "DELIVERED") && (oldStatus === "PENDING" || oldStatus === "CONFIRMED" || oldStatus === "PACKED")) {
        // Only generate if no invoice exists yet
        if (!order.invoice_number && !order.invoice) {
            try {
                await generateInvoice(orderId, order.customer_id, Number(order.total_price));
            } catch (e: any) {
                console.error("Auto-invoice generation failed for order", orderId, ":", e?.message || e);
            }
        }
    }

    // Update Order
    const logs = order.logs || [];
    logs.push({
        from: oldStatus,
        to: newStatus,
        at: new Date().toISOString(),
        by: changedBy,
        note: note || `Status updated from ${oldStatus} to ${newStatus}`
    });

    const [updatedOrder] = await sql`
        UPDATE orders 
        SET status = ${newStatus}, 
            logs = ${sql.json(logs)},
            updated_at = NOW()
        WHERE id = ${orderId}
        RETURNING *
    `;

    // Notify Customer
    try {
        await createNotification(
            "ORDER_STATUS",
            `Order ${newStatus}`,
            `Order #${orderId.slice(0, 8)} status updated to ${newStatus}.`,
            { orderId, userId: order.customer_id }
        );
    } catch (e) {
        console.error("Status notification failed:", e);
    }

    return updatedOrder;
};
