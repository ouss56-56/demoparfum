import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
    try {
        await requireAdminSession();

        const body = await request.json();
        const { customerId, newPassword } = body;

        if (!customerId || !newPassword) {
            return NextResponse.json(
                { success: false, error: "Customer ID and new password are required" },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { success: false, error: "Password must be at least 6 characters" },
                { status: 400 }
            );
        }

        const [customer] = await sql`SELECT id FROM customers WHERE id = ${customerId} LIMIT 1`;

        if (!customer) {
            return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await sql`UPDATE customers SET password_hash = ${passwordHash} WHERE id = ${customerId}`;

        return NextResponse.json(
            { success: true, message: "Password reset successfully" },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("Admin reset trader password error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
