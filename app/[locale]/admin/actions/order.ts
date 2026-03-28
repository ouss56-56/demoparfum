"use server";

import { sql } from "@/lib/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { handleStatusUpdate } from "@/services/order-handler";
import { generateInvoice } from "@/services/invoice-generator";
import { OrderStatus } from "@/lib/constants";
import { requireCustomerSession } from "@/lib/customer-auth";
import { logAdminAction } from "@/services/audit-service";
import { cookies } from "next/headers";
import { verifyJwtToken } from "@/lib/auth";

async function getAdminId() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("admin_token")?.value;
        const payload = token ? await verifyJwtToken(token) : null;
        return payload?.sub as string | undefined;
    } catch {
        return undefined;
    }
}

export async function cancelOrderAction(orderId: string) {
    try {
        const customer = await requireCustomerSession();
        
        const [order] = await sql`SELECT * FROM orders WHERE id = ${orderId} LIMIT 1`;

        if (!order) {
            return { success: false, error: "Order not found" };
        }

        if (order.customer_id !== customer.id) {
            return { success: false, error: "Unauthorized" };
        }

        if (order.status !== OrderStatus.PENDING) {
            return { success: false, error: "Only pending orders can be cancelled." };
        }

        await handleStatusUpdate(orderId, OrderStatus.CANCELLED, "CUSTOMER");

        revalidatePath(`/account/orders/${orderId}`);
        revalidatePath("/account/orders");
        (revalidateTag as any)("products");
        
        return { success: true };
    } catch (error) {
        console.error("Cancel order error:", error);
        return { success: false, error: "Failed to cancel order" };
    }
}

export async function adminUpdateOrderStatus(orderId: string, status: string) {
    try {
        await handleStatusUpdate(orderId, status, "ADMIN");
        
        const adminId = await getAdminId();
        if (adminId) {
            await logAdminAction({
                adminId,
                action: "UPDATE_ORDER_STATUS",
                targetType: "ORDER",
                targetId: orderId,
                metadata: { status }
            });
        }

        revalidatePath("/admin/orders");
        revalidatePath(`/account/orders/${orderId}`);
        revalidatePath("/account/orders");
        (revalidateTag as any)("products");
        
        return { success: true };
    } catch (error) {
        console.error("Admin update order status error:", error);
        return { success: false, error: "Failed to update order status" };
    }
}

export async function updateOrderPayment(orderId: string, amountPaid: number) {
    try {
        const [order] = await sql`SELECT total_price FROM orders WHERE id = ${orderId} LIMIT 1`;

        if (!order) throw new Error("Order not found");

        const totalAmount = Number(order.total_price);
        let paymentStatus: "PAID" | "PARTIAL" | "UNPAID" = "UNPAID";

        if (amountPaid >= totalAmount) {
            paymentStatus = "PAID";
        } else if (amountPaid > 0) {
            paymentStatus = "PARTIAL";
        }

        await sql`
            UPDATE orders SET
                amount_paid = ${amountPaid},
                payment_status = ${paymentStatus},
                updated_at = NOW()
            WHERE id = ${orderId}
        `;

        const adminId = await getAdminId();
        if (adminId) {
            await logAdminAction({
                adminId,
                action: "UPDATE_PAYMENT",
                targetType: "ORDER",
                targetId: orderId,
                metadata: { amountPaid, paymentStatus }
            });
        }

        revalidatePath("/admin/dashboard");
        revalidatePath("/admin/orders");
        return { success: true };
    } catch (error) {
        console.error("Update payment error:", error);
        return { success: false, error: "Failed to update payment" };
    }
}

export async function generateInvoiceAction(orderId: string, amount: number) {
    try {
        const [order] = await sql`SELECT customer_id FROM orders WHERE id = ${orderId} LIMIT 1`;
        if (!order) throw new Error("Order not found");
        await generateInvoice(orderId, order.customer_id, amount);
        revalidatePath("/admin/orders");
        revalidatePath(`/account/orders/${orderId}`);
        return { success: true };
    } catch (error) {
        console.error("Generate invoice error:", error);
        return { success: false, error: "Failed to generate invoice" };
    }
}

export async function deleteOrderAction(orderId: string) {
    try {
        // First delete order_items to avoid foreign key constraint errors
        await sql`DELETE FROM order_items WHERE order_id = ${orderId}`;
        await sql`DELETE FROM orders WHERE id = ${orderId}`;
        
        const adminId = await getAdminId();
        if (adminId) {
            await logAdminAction({
                adminId,
                action: "DELETE_ORDER",
                targetType: "ORDER",
                targetId: orderId,
                metadata: {}
            });
        }

        revalidatePath("/admin/orders");
        return { success: true };
    } catch (error) {
        console.error("Delete order error:", error);
        return { success: false, error: "Failed to delete order" };
    }
}
