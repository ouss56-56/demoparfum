import { NextRequest, NextResponse } from "next/server";
import { getCommunesByWilayaCode } from "algerian-geo";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const wilayaId = searchParams.get("wilayaId");

    if (!wilayaId) {
        return NextResponse.json({ success: false, error: "wilayaId is required" }, { status: 400 });
    }

    try {
        // algerian-geo uses string codes like "01", "02"
        const formattedId = String(wilayaId).padStart(2, '0');
        const communes = getCommunesByWilayaCode(formattedId).map((c: any) => ({
            id: c.name,
            name: c.name,
            name_en: c.name,
            name_ar: c.name,
        }));

        return NextResponse.json({ success: true, data: communes });
    } catch (error) {
        console.error("Communes API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to fetch communes" }, { status: 500 });
    }
}
