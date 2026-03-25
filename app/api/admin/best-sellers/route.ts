import { NextResponse } from "next/server";
import { getBestSellers } from "@/services/product-service";
import { requireAdminSession } from "@/lib/admin-auth";

export async function GET() {
    try {
        await requireAdminSession();
        const products = await getBestSellers(20);
        return NextResponse.json({ success: true, data: products });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
