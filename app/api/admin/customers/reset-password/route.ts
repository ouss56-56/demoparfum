import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireAdminSession } from "@/lib/admin-auth";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
    try {
        await requireAdminSession();

        // ── Parse Body ──────────────────────────────────────────────────
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

        // ── Verify Customer Exists ──────────────────────────────────────
        const { data: customer, error: fetchError } = await supabaseAdmin
            .from("customers")
            .select("id")
            .eq("id", customerId)
            .single();

        if (fetchError || !customer) {
            return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
        }

        // ── Hash & Update ───────────────────────────────────────────────
        const passwordHash = await bcrypt.hash(newPassword, 10);
        const { error: updateError } = await supabaseAdmin
            .from("customers")
            .update({ password_hash: passwordHash })
            .eq("id", customerId);

        if (updateError) throw updateError;

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
