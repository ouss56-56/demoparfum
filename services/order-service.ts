import { sql } from "@/lib/db";
import { notifyNewOrder } from "./notification-service";
import { Errors } from "@/lib/errors";
import { unstable_cache, revalidateTag, revalidatePath } from "next/cache";
import { OrderStatus } from "@/lib/constants";
import { handleStatusUpdate } from "./order-handler";

export interface OrderItem {
    id: string;
    productId: string;
    quantity: number;
    price: number;
    volumeId: string;
    volume?: any;
    product?: {
        name: string;
        brand: string;
        imageUrl: string;
    };
}

export interface Order {
    id: string;
    customerId: string;
    totalPrice: number;
    status: string;
    createdAt: Date;
    items: OrderItem[];
    customer?: any;
    shipping?: any;
    invoice?: any;
    wilayaName?: string | null;
    wilayaNumber?: string | null;
    amountPaid?: number;
    paymentStatus?: string;
    updatedAt: Date;
    logs: any[];
}

interface OrderItemInput {
    productId: string;
    quantity: number;
    volumeId: string;
}

interface CreateOrderInput {
    customerId: string;
    items: OrderItemInput[];
    createdBy?: "CUSTOMER" | "ADMIN" | "SYSTEM";
    notes?: string;
    wilayaNumber?: string;
    wilayaName?: string;
    commune?: string;
}

function mapOrder(data: any): Order {
    return {
        id: data.id,
        customerId: data.customer_id || "",
        totalPrice: Number(data.total_price || 0),
        status: data.status || "PENDING",
        createdAt: new Date(data.created_at),
        items: (data.order_items || []).map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            quantity: Number(item.quantity || 0),
            price: Number(item.price || 0),
            volumeId: item.volume_id,
            volume: item.volume_data,
            product: item.products ? {
                name: item.products.name,
                brand: item.products.brand,
                imageUrl: item.products.image_url
            } : undefined
        })),
        customer: data.users ? {
            id: data.users.id,
            name: data.users.name,
            shopName: data.users.shop_name,
            phone: data.users.phone,
            address: data.users.address,
            wilaya: data.users.wilaya,
            commune: data.users.commune
        } : null,
        shipping: data.shipping || null,
        invoice: data.invoice_number ? { invoiceNumber: data.invoice_number } : null,
        wilayaName: data.wilaya_name || null,
        wilayaNumber: data.wilaya_number || null,
        amountPaid: Number(data.amount_paid || 0),
        paymentStatus: data.payment_status || 'UNPAID',
        updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(data.created_at),
        logs: data.logs || [],
    };
}

export const createOrder = async (input: CreateOrderInput) => {
    if (!input.items || input.items.length === 0) {
        throw Errors.invalidInput("Cannot create an order without items.");
    }

    const productIds = [...new Set(input.items.map(i => i.productId))];
    const products = await sql`SELECT * FROM products WHERE id IN ${sql(productIds)}`;
    if (!products || products.length === 0) throw new Error("Failed to fetch products");

    const productsMap = new Map(products.map(p => [p.id, p]));
    const itemsWithData = input.items.map(item => {
        const product = productsMap.get(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productId}`);
        
        const volume = (product.volumes || []).find((v: any) => v.id === item.volumeId);
        const unitPrice = volume?.price ? Number(volume.price) : Number(product.base_price || 0);

        return {
            ...item,
            price: unitPrice,
            volume: volume || { id: item.volumeId, price: unitPrice, weight: 100 } 
        };
    });

    const [result] = await sql`
        SELECT create_order(
            ${input.customerId}::UUID, 
            ${sql.json(itemsWithData)}, 
            ${input.wilayaName || null}, 
            ${input.wilayaNumber || null}, 
            ${input.notes || "Order placed successfully."},
            ${input.commune || null}
        ) as order_id
    `;

    if (!result || !result.order_id) throw new Error("Database failed to create order.");

    const orderId = result.order_id;
    (revalidateTag as any)(`orders:${input.customerId}`);
    (revalidateTag as any)("orders");

    try {
        await notifyNewOrder(orderId, "Customer", itemsWithData.reduce((s, i) => s + (i.price * i.quantity), 0));
    } catch (e) {
        console.error("Notification error:", e);
    }

    return getOrderById(orderId);
};

export const getOrders = async (limit = 50): Promise<Order[]> => {
    const data = await sql`
        SELECT 
            o.*,
            inv.invoice_number,
            (SELECT row_to_json(u) FROM users u WHERE u.id = o.customer_id) as users,
            (
                SELECT json_agg(json_build_object(
                    'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price', oi.price,
                    'volume_id', oi.volume_id, 'volume_data', oi.volume_data,
                    'products', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
                ))
                FROM order_items oi WHERE oi.order_id = o.id
            ) as order_items
        FROM orders o
        LEFT JOIN invoices inv ON o.id = inv.order_id
        ORDER BY o.created_at DESC
        LIMIT ${limit}
    `;
    return (data || []).map(mapOrder);
};

export const getOrderById = async (id: string): Promise<Order | null> => {
    const [data] = await sql`
        SELECT 
            o.*,
            inv.invoice_number,
            (SELECT row_to_json(u) FROM users u WHERE u.id = o.customer_id) as users,
            (
                SELECT json_agg(json_build_object(
                    'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price', oi.price,
                    'volume_id', oi.volume_id, 'volume_data', oi.volume_data,
                    'products', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
                ))
                FROM order_items oi WHERE oi.order_id = o.id
            ) as order_items
        FROM orders o
        LEFT JOIN invoices inv ON o.id = inv.order_id
        WHERE o.id = ${id}
        LIMIT 1
    `;
    if (!data) return null;
    return mapOrder(data);
};

export const getOrdersByCustomer = (customerId: string, limit = 10, skip = 0): Promise<Order[]> => {
    return unstable_cache(
        async () => {
            const data = await sql`
                SELECT 
                    o.*,
                    inv.invoice_number,
                    (SELECT row_to_json(u) FROM users u WHERE u.id = o.customer_id) as users,
                    (
                        SELECT json_agg(json_build_object(
                            'id', oi.id, 'product_id', oi.product_id, 'quantity', oi.quantity, 'price', oi.price,
                            'volume_id', oi.volume_id, 'volume_data', oi.volume_data,
                            'products', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
                        ))
                        FROM order_items oi WHERE oi.order_id = o.id
                    ) as order_items
                FROM orders o
                LEFT JOIN invoices inv ON o.id = inv.order_id
                WHERE o.customer_id = ${customerId}
                ORDER BY o.created_at DESC
                LIMIT ${limit} OFFSET ${skip}
            `;
            return (data || []).map(mapOrder);
        },
        [`orders-${customerId}-${limit}-${skip}`],
        { tags: [`orders:${customerId}`, "orders"], revalidate: 30 }
    )();
};

export const countOrdersByCustomer = async (customerId: string) => {
    const [result] = await sql`SELECT count(*) as count FROM orders WHERE customer_id = ${customerId}`;
    return Number(result?.count || 0);
};

export const getReorderItems = async (orderId: string) => {
    const items = await sql`
        SELECT 
            oi.*,
            p.name
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ${orderId}
    `;
    return (items || []).map(item => ({
        productId: item.product_id,
        quantity: item.quantity,
        volumeId: item.volume_id,
        name: item.name
    }));
};

export const updateOrderShipping = async (orderId: string, data: any) => {
    await sql`
        UPDATE orders 
        SET shipping = ${sql.json(data)}
        WHERE id = ${orderId}
    `;
};

export const updateOrderStatus = async (orderId: string, status: string, changedBy: string = "ADMIN", note?: string) => {
    const updated = await handleStatusUpdate(orderId, status, changedBy, note);
    
    // Standard revalidation tags
    (revalidateTag as any)("orders");
    (revalidateTag as any)(`orders:${updated.customer_id}`);
    
    // Path-based revalidation for immediate UI sync
    try {
        (revalidatePath as any)("/", "layout");
    } catch (e) {
        console.error("Revalidation error:", e);
    }
    
    return getOrderById(orderId);
};

export const OrderService = {
    createOrder,
    getOrders,
    getOrderById,
    getOrdersByCustomer,
    countOrdersByCustomer,
    getReorderItems,
    updateOrderShipping,
    updateOrderStatus
};
