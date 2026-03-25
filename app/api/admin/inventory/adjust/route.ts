import { NextResponse } from "next/server";
import { adjustStock } from "@/services/inventory-service";
import { logAdminAction, logSystemError } from "@/services/audit-service";
import { requireAdminSession } from "@/lib/admin-auth";
import { errorResponse, Errors } from "@/lib/errors";

export async function POST(request: Request) {
    try {
        const admin = await requireAdminSession();
        const body = await request.json();
        const { productId, quantity, reason } = body;

        if (!productId || typeof quantity !== "number" || !reason) {
            return errorResponse(Errors.invalidInput("Missing required fields: productId, quantity, reason"));
        }

        const product = await adjustStock(productId, quantity, reason);

        if (admin) {
            await logAdminAction({
                adminId: admin.id,
                action: "ADJUST_STOCK",
                targetType: "INVENTORY",
                targetId: productId,
                metadata: { quantity, reason },
            });
        }

        return NextResponse.json({ success: true, data: product });
    } catch (error: any) {
        await logSystemError({
            message: error.message,
            path: "/api/admin/inventory/adjust",
            method: "POST",
            stackTrace: error.stack,
        });
        const { body, status } = errorResponse(error);
        return NextResponse.json(body, { status });
    }
}
