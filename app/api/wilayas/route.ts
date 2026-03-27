import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
    try {
        const wilayas = await sql`
            SELECT code as id, code as number, name, name as name_en, name as name_ar 
            FROM wilayas 
            ORDER BY code ASC
        `;

        return NextResponse.json({ success: true, data: wilayas });
    } catch (error) {
        console.error("Wilayas API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch wilayas" }, { status: 500 });
    }
}
