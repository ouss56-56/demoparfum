import { sql } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    if (!productId) {
        return NextResponse.json({ success: false, error: "productId is required" }, { status: 400 });
    }

    try {
        const data = await sql`
            SELECT * FROM inventory_logs
            WHERE product_id = ${productId}
            ORDER BY created_at DESC
            LIMIT 10
        `;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("Inventory Logs API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch logs" }, { status: 500 });
    }
}
