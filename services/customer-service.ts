import { supabaseAdmin } from "@/lib/supabase-admin";
import { sql } from "@/lib/db";
import bcrypt from "bcryptjs";

export interface Customer {
    id: string;
    phone: string;
    passwordHash?: string;
    name: string;
    shopName: string;
    wilaya: string;
    commune: string;
    address: string;
    role: string;
    status?: string;
    createdAt: Date;
    ordersCount?: number;
    orders?: any[];
    _count?: { orders: number };
}

// ── REGISTER ──────────────────────────────────────────────────────────────
export const registerCustomer = async (data: {
    name: string;
    phone: string;
    password: string;
    wilayaNumber: string;
    wilayaName: string;
    commune: string;
    address: string;
    shopName: string;
    role?: string;
}) => {
    // Check if phone is already registered
    const [existing] = await sql`
        SELECT id FROM customers WHERE phone = ${data.phone} LIMIT 1
    `;
    
    if (existing) {
        throw new Error("A customer with this phone number already exists");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const { password, ...rest } = data;

    const [newCustomer] = await sql`
        INSERT INTO customers (
            name, phone, password_hash, shop_name, wilaya, wilaya_id, commune, address, role
        ) VALUES (
            ${data.name}, ${data.phone}, ${passwordHash}, ${data.shopName}, 
            ${`${data.wilayaNumber} - ${data.wilayaName}`}, ${Number(data.wilayaNumber)}, 
            ${data.commune}, ${data.address}, ${data.role || "TRADER"}
        )
        RETURNING *
    `;

    return { 
        id: newCustomer.id, 
        name: newCustomer.name,
        phone: newCustomer.phone,
        shopName: newCustomer.shop_name,
        wilaya: newCustomer.wilaya,
        commune: newCustomer.commune,
        address: newCustomer.address,
        role: newCustomer.role 
    };
};

// ── READ ──────────────────────────────────────────────────────────────────
export const getCustomerById = async (id: string): Promise<Customer | null> => {
    try {
        const [customer] = await sql`
            SELECT * FROM customers WHERE id = ${id} LIMIT 1
        `;

        if (!customer) return null;

        // Fetch orders count and recent orders
        const orders = await sql`
            SELECT * FROM orders 
            WHERE customer_id = ${id} 
            ORDER BY created_at DESC
        `;

        return {
            id: customer.id,
            phone: customer.phone,
            name: customer.name || "Unknown",
            shopName: customer.shop_name || "Customer",
            wilaya: customer.wilaya || "",
            commune: customer.commune || "",
            address: customer.address || "",
            role: customer.role || "TRADER",
            status: customer.status || "ACTIVE",
            createdAt: new Date(customer.created_at),
            ordersCount: orders?.length || 0,
            orders: orders || []
        };
    } catch (err) {
        console.error("Customer fetch error (getCustomerById):", err);
        return null;
    }
};

export const getCustomerByPhone = async (phone: string): Promise<Customer | null> => {
    try {
        const [customer] = await sql`
            SELECT * FROM customers WHERE phone = ${phone} LIMIT 1
        `;

        if (!customer) return null;

        return {
            id: customer.id,
            phone: customer.phone,
            name: customer.name || "Unknown",
            shopName: customer.shop_name || "Customer",
            wilaya: customer.wilaya || "",
            commune: customer.commune || "",
            address: customer.address || "",
            role: customer.role || "TRADER",
            status: customer.status || "ACTIVE",
            passwordHash: customer.password_hash,
            createdAt: new Date(customer.created_at),
        };
    } catch (err) {
        console.error("Customer fetch error (getCustomerByPhone):", err);
        return null;
    }
};

export const getCustomers = async (limit = 1000, startAfterStr?: string): Promise<Customer[]> => {
    try {
        let customers;
        if (startAfterStr) {
            customers = await sql`
                SELECT *, 
                    (SELECT count(*) FROM orders WHERE orders.customer_id = customers.id) as orders_count
                FROM customers 
                WHERE created_at < ${startAfterStr}
                ORDER BY created_at DESC 
                LIMIT ${limit}
            `;
        } else {
            customers = await sql`
                SELECT *, 
                    (SELECT count(*) FROM orders WHERE orders.customer_id = customers.id) as orders_count
                FROM customers 
                ORDER BY created_at DESC 
                LIMIT ${limit}
            `;
        }
        
        return (customers || []).map(customer => ({
            id: customer.id,
            phone: customer.phone,
            name: customer.name || "Unknown",
            shopName: customer.shop_name || "Customer",
            wilaya: customer.wilaya || "",
            commune: customer.commune || "",
            address: customer.address || "",
            role: customer.role || "TRADER",
            status: customer.status || "ACTIVE",
            createdAt: new Date(customer.created_at),
            ordersCount: Number(customer.orders_count) || 0,
            _count: { orders: Number(customer.orders_count) || 0 }
        }));
    } catch (err) {
        console.error("Customers fetch error (getCustomers):", err);
        return [];
    }
};

// ── UPDATE ────────────────────────────────────────────────────────────────
export const updateCustomer = async (
    id: string,
    data: Partial<{
        name: string;
        phone: string;
        wilayaNumber: string;
        wilayaName: string;
        commune: string;
        address: string;
        shopName: string;
    }>
) => {
    const updateObj: any = {};
    if (data.name) updateObj.name = data.name;
    if (data.phone) updateObj.phone = data.phone;
    if (data.address) updateObj.address = data.address;
    if (data.shopName) updateObj.shop_name = data.shopName;
    if (data.commune) updateObj.commune = data.commune;
    if (data.wilayaNumber && data.wilayaName) {
        updateObj.wilaya = `${data.wilayaNumber} - ${data.wilayaName}`;
        updateObj.wilaya_id = Number(data.wilayaNumber);
    }

    const [updated] = await sql`
        UPDATE customers SET ${sql(updateObj)}
        WHERE id = ${id}
        RETURNING *
    `;

    return { id, ...data };
};

// ── ADMINISTRATIVE ────────────────────────────────────────────────────────
export const suspendCustomer = async (id: string, status: "ACTIVE" | "SUSPENDED") => {
    const [data] = await sql`
        UPDATE customers SET status = ${status} WHERE id = ${id} RETURNING *
    `;
    return data;
};

export const deleteCustomer = async (id: string) => {
    // Note: We can only delete the DB record. 
    // If Supabase Auth is being used, we can't delete the auth user without the service role key.
    // However, this project seems to use custom JWTs mostly.
    
    await sql`DELETE FROM customers WHERE id = ${id}`;
    return true;
};

// ── EXPORT OBJECT ─────────────────────────────────────────────────────────
export const CustomerService = {
    registerCustomer,
    getCustomerById,
    getCustomerByPhone,
    getCustomers,
    updateCustomer,
    suspendCustomer,
    deleteCustomer
};
