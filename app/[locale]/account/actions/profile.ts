"use server";

import { cookies } from "next/headers";
import { verifyJwtToken } from "@/lib/auth";
import { updateCustomer } from "@/services/customer-service";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function updateMerchantProfile(formData: FormData) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("customer_token")?.value;

        if (!token) {
            return { success: false, error: "Unauthorized" };
        }

        const payload = await verifyJwtToken(token);
        if (!payload || !payload.sub) {
            return { success: false, error: "Invalid token" };
        }

        const customerId = payload.sub as string;

        const name = formData.get("name") as string;
        const shopName = formData.get("shopName") as string;
        const currentPassword = formData.get("currentPassword") as string;
        const newPassword = formData.get("newPassword") as string;
        const address = formData.get("address") as string;

        if (currentPassword && newPassword) {
            const [customer] = await sql`
                SELECT password_hash FROM customers WHERE id = ${customerId} LIMIT 1
            `;

            if (!customer || !customer.password_hash) {
                return { success: false, error: "Account error: cannot change password" };
            }

            const isPasswordValid = await bcrypt.compare(currentPassword, customer.password_hash);
            if (!isPasswordValid) {
                return { success: false, error: "Incorrect current password" };
            }

            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            
            await sql`
                UPDATE customers SET password_hash = ${hashedNewPassword} WHERE id = ${customerId}
            `;
        }

        // Update profile
        await updateCustomer(customerId, {
            name,
            shopName,
            address,
        });

        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        console.error("Update profile error:", error);
        return { success: false, error: error.message || "Failed to update profile" };
    }
}
