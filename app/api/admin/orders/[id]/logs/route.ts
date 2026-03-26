import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        
        const logs = await sql`
            SELECT * FROM order_status_logs
            WHERE order_id = ${id}
            ORDER BY created_at DESC
        `;

        return NextResponse.json(logs || []);
    } catch (error: any) {
        console.error("[OrderLogsAPI] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
