import { NextResponse } from "next/server";
import { getAllWilayas } from "algerian-geo";

export async function GET() {
    try {
        const wilayas = getAllWilayas().map((w: any) => ({
            id: w.code,
            number: w.code,
            name: w.name,
            name_en: w.name,
            name_ar: w.name,
        }));

        return NextResponse.json({ success: true, data: wilayas });
    } catch (error) {
        console.error("Wilayas API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch wilayas" }, { status: 500 });
    }
}
