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
        const [counts] = await sql`
            SELECT 
                (SELECT count(*) FROM orders) as orders_count,
                (SELECT count(*) FROM customers) as customers_count,
                (SELECT count(*) FROM products) as products_count,
                (SELECT SUM(total_price) FROM orders WHERE status != 'CANCELLED') as total_revenue
        `;

        return {
            totalOrders: Number(counts.orders_count) || 0,
            totalCustomers: Number(counts.customers_count) || 0,
            totalProducts: Number(counts.products_count) || 0,
            totalRevenue: Number(counts.total_revenue) || 0,
        };
    } catch (error) {
        console.error("Error getting admin stats:", error);
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
