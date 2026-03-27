import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const wilayaId = searchParams.get("wilayaId");

    if (!wilayaId) {
        return NextResponse.json({ success: false, error: "wilayaId is required" }, { status: 400 });
    }

    try {
        const formattedId = String(wilayaId).padStart(2, '0');
        const communes = await sql`
            SELECT name as id, name, name as name_en, name as name_ar 
            FROM communes 
            WHERE wilaya_code = ${formattedId}
            ORDER BY name ASC
        `;

        return NextResponse.json({ success: true, data: communes });
    } catch (error) {
        console.error("Communes API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch communes" }, { status: 500 });
    }
}
