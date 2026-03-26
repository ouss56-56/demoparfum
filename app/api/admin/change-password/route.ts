import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyJwtToken } from "@/lib/auth";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("admin_token")?.value;

        if (!token) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const payload = await verifyJwtToken(token);
        if (!payload || !payload.sub) {
            return NextResponse.json({ success: false, error: "Invalid token" }, { status: 401 });
        }

        const adminId = payload.sub as string;

        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ success: false, error: "Current and new password are required" }, { status: 400 });
        }

        const [admin] = await sql`SELECT * FROM admins WHERE id = ${adminId} LIMIT 1`;

        if (!admin) {
            return NextResponse.json({ success: false, error: "Admin not found" }, { status: 404 });
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, admin.password_hash);

        if (!isPasswordValid) {
            return NextResponse.json({ success: false, error: "Incorrect current password" }, { status: 400 });
        }

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        await sql`UPDATE admins SET password_hash = ${hashedNewPassword} WHERE id = ${adminId}`;

        return NextResponse.json({ success: true, message: "Password updated successfully" }, { status: 200 });

    } catch (error) {
        console.error("Admin change password error:", error);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
}
