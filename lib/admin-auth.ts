import { cookies } from "next/headers";
import { verifyJwtToken } from "./auth";
import { supabaseAdmin } from "./supabase-admin";

export interface AdminSession {
    id: string;
    email: string;
    name: string | null;
    role: string;
}

/**
 * Retrieves the current admin session from the admin_token cookie.
 * Verifies the token and checks the database for the active admin record.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("admin_token")?.value;

        if (!token) return null;

        const payload = await verifyJwtToken(token);
        if (!payload || !payload.sub || !["ADMIN", "SUPER_ADMIN", "VENDOR"].includes(payload.role as string)) {
            return null;
        }

        const { data: admin, error } = await supabaseAdmin
            .from('admins')
            .select('id, email, name, role')
            .eq('id', payload.sub as string)
            .single();

        if (error || !admin) {
            console.error("[AdminAuth] Session verification failed: Admin record not found or error occurred.");
            return null;
        }

        return {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
        };
    } catch (error) {
        console.error("[AdminAuth] Fatal session error:", error);
        return null;
    }
}

/**
 * Ensures an admin session exists, throwing an error if not.
 * Useful for protected API routes.
 */
export async function requireAdminSession(): Promise<AdminSession> {
    const session = await getAdminSession();
    if (!session) {
        throw new Error("Unauthorized: Administrative session required");
    }
    return session;
}
