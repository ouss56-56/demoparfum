import { cookies } from "next/headers";
import { verifyJwtToken } from "./auth";
import { sql } from "@/lib/db";

export async function getCustomerSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get("customer_token")?.value;

    if (!token) return null;

    try {
        const payload = await verifyJwtToken(token);
        if (!payload || !payload.sub || payload.role !== "TRADER") {
            return null;
        }

        const [customer] = await sql`
            SELECT * FROM customers WHERE id = ${payload.sub as string} LIMIT 1
        `;

        if (!customer) return null;

        if (customer.status === "SUSPENDED") {
            return null;
        }

        return {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            shopName: customer.shop_name,
            wilaya: customer.wilaya,
            address: customer.address,
        };
    } catch (error) {
        return null;
    }
}

export async function requireCustomerSession() {
    const session = await getCustomerSession();
    if (!session) {
        throw new Error("Unauthorized: Trader session required");
    }
    return session;
}
