import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
    try {
        const data = await sql`SELECT name FROM brands ORDER BY name ASC`;

        const sortedBrands = (data || []).map((b: any) => b.name);
        
        const response = NextResponse.json({ 
            success: true, 
            data: sortedBrands 
        });

        response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600');
        
        return response;
    } catch (error) {
        console.error("Brands fetch error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to fetch brands" },
            { status: 500 }
        );
    }
}
