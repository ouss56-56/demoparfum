import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

export interface Admin {
    id: string;
    email: string;
    passwordHash?: string;
    name?: string;
    role: string;
    createdAt: Date;
}

export const createAdminUser = async (data: {
    email: string;
    password: string;
    name?: string;
}) => {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    const [admin] = await sql`
        INSERT INTO admins (email, password_hash, name, role)
        VALUES (${data.email}, ${hashedPassword}, ${data.name ?? null}, 'SUPER_ADMIN')
        RETURNING *
    `;

    return { 
        id: admin.id, 
        email: admin.email,
        name: admin.name,
        role: admin.role,
        createdAt: new Date(admin.created_at)
    };
};

export const getAdminStats = async () => {
    try {
        // Fetch stats individually to prevent one missing table from breaking everything
        const [ordersResult] = await sql`SELECT count(*) as count FROM orders`.catch(() => [{ count: 0 }]);
        const [customersResult] = await sql`SELECT count(*) as count FROM customers`.catch(() => [{ count: 0 }]);
        const [productsResult] = await sql`SELECT count(*) as count FROM products`.catch(() => [{ count: 0 }]);
        const [revenueResult] = await sql`
            SELECT SUM(total_price) as total 
            FROM orders 
            WHERE status != 'CANCELLED'
        `.catch(() => [{ total: 0 }]);

        return {
            totalOrders: Number(ordersResult?.count) || 0,
            totalCustomers: Number(customersResult?.count) || 0,
            totalProducts: Number(productsResult?.count) || 0,
            totalRevenue: Number(revenueResult?.total) || 0,
        };
    } catch (error) {
        console.error("Error in AdminService.getAdminStats:", error);
        return {
            totalOrders: 0,
            totalCustomers: 0,
            totalProducts: 0,
            totalRevenue: 0,
        };
    }
};

export const validateAdminCredentials = async (email: string, password: string) => {
    const [admin] = await sql`
        SELECT * FROM admins WHERE email = ${email} LIMIT 1
    `;
    
    if (!admin) return null;
    
    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) return null;

    return { 
        id: admin.id, 
        email: admin.email,
        name: admin.name,
        role: admin.role,
        createdAt: new Date(admin.created_at)
    };
};

export const AdminService = {
    createAdminUser,
    getAdminStats,
    validateAdminCredentials
};
