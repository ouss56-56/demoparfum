import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";

export async function PUT(request: Request) {
    try {
        await requireAdminSession();

        const body = await request.json();
        const { orderId, amountPaid } = body;

        if (!orderId || typeof amountPaid !== "number" || amountPaid < 0) {
            return NextResponse.json({ success: false, message: "Invalid input: orderId and amountPaid (>= 0) required" }, { status: 400 });
        }

        const [order] = await sql`
            SELECT total_price, amount_paid, payment_status, logs FROM orders WHERE id = ${orderId} LIMIT 1
        `;

        if (!order) {
            return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
        }

        const totalPrice = Number(order.total_price || 0);
        const newPaymentStatus = amountPaid >= totalPrice ? "PAID" : amountPaid > 0 ? "PARTIAL" : "UNPAID";
        const balanceDue = Math.max(0, totalPrice - amountPaid);

        const existingLogs = order.logs || [];
        const newLog = {
            id: crypto.randomUUID(),
            message: `Payment updated: ${amountPaid.toLocaleString()} DZD received. Balance: ${balanceDue.toLocaleString()} DZD. Status: ${newPaymentStatus}`,
            status: order.payment_status || "UNPAID",
            changedBy: "ADMIN",
            createdAt: new Date().toISOString(),
        };

        await sql`
            UPDATE orders SET
                amount_paid = ${amountPaid},
                payment_status = ${newPaymentStatus},
                updated_at = NOW(),
                logs = ${JSON.stringify([...existingLogs, newLog])}::jsonb
            WHERE id = ${orderId}
        `;

        return NextResponse.json({
            success: true,
            data: {
                amountPaid,
                paymentStatus: newPaymentStatus,
                balanceDue,
            }
        });
    } catch (error: any) {
        console.error("Payment API error:", error);
        return NextResponse.json({ success: false, message: error.message || "Internal error" }, { status: 500 });
    }
}
