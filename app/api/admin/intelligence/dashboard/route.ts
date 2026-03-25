import { NextResponse } from "next/server";
import { getIntelligenceStats } from "@/services/intelligence-service";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdminSession();
        const stats = await getIntelligenceStats();
        return NextResponse.json(stats);
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
