import { supabaseAdmin } from "@/lib/supabase-admin";
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
    // 1. Create user in Supabase Auth
    // Note: This requires the admin to have 'service_role' or proper permissions to create users.
    // However, since we are separating from Firebase Auth entirely, we will use our own 'admins' table
    // for now to match the existing logic, or use Supabase Auth's 'auth.users'.
    // Given the separation request, we'll store them in our public.admins table.
    
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    // For now, we'll use a custom 'admins' table.
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
    console.log(`[validateAdminCredentials] Checking email: ${email}`);
    const [admin] = await sql`
        SELECT * FROM admins WHERE email = ${email} LIMIT 1
    `;
    
    if (!admin) {
        console.log(`[validateAdminCredentials] Admin not found for email: ${email}`);
        return null;
    }
    
    console.log(`[validateAdminCredentials] Admin found, verifying password hash...`);
    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
        console.log(`[validateAdminCredentials] Invalid password for: ${email}`);
        return null;
    }

    console.log(`[validateAdminCredentials] Password valid for: ${email}`);
    return { 
        id: admin.id, 
        email: admin.email,
        name: admin.name,
        role: admin.role,
        createdAt: new Date(admin.created_at)
    };
};
