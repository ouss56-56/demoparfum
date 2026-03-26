import { supabaseAdmin } from "@/lib/supabase-admin";
import { sql } from "@/lib/db";
import { notifyNewOrder, notifyLowStock } from "./notification-service";
import { Errors } from "@/lib/errors";
import { unstable_cache, revalidateTag } from "next/cache";
import { OrderStatus } from "@/lib/constants";

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

// ── TYPES (Internal) ──────────────────────────────────────────────────────
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
        customer: data.customers ? {
            id: data.customers.id,
            name: data.customers.name,
            shopName: data.customers.shop_name,
            phone: data.customers.phone,
            address: data.customers.address,
            wilaya: data.customers.wilaya,
            commune: data.customers.commune
        } : null,
        shipping: data.shipping || null,
        invoice: data.invoice || null,
        wilayaName: data.wilaya_name || null,
        wilayaNumber: data.wilaya_number || null,
        amountPaid: Number(data.amount_paid || 0),
        paymentStatus: data.payment_status || 'UNPAID',
        updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(data.created_at),
        logs: (data.logs || []).sort((a: any, b: any) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        }),
    };
}

// ── ATOMIC ORDER CREATION ──────────────────────────────────────────────────
export const createOrder = async (input: CreateOrderInput) => {
    if (!input.items || input.items.length === 0) {
        throw Errors.invalidInput("Cannot create an order without items.");
    }

    // Prepare items for RPC
    // We need to fetch prices and volume data first for the RPC
    const productIds = [...new Set(input.items.map(i => i.productId))];
    const products = await sql`
        SELECT * FROM products WHERE id IN (${productIds})
    `;

    if (!products || products.length === 0) throw new Error("Failed to fetch products for order validation");

    const productsMap = new Map(products.map(p => [p.id, p]));
    const itemsWithData = input.items.map(item => {
        const product = productsMap.get(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productId}`);
        
        let volume = (product.volumes || []).find((v: any) => v.id === item.volumeId);
        
        // Handle default volumes (v100, v500, v1000) if not explicitly in the DB
        if (!volume && item.volumeId?.startsWith('v')) {
            const weight = parseInt(item.volumeId.replace('v', ''));
            if (!isNaN(weight)) {
                const basePrice = Number(product.base_price || 0);
                const multiplier = weight === 100 ? 1 : weight === 500 ? 5 : 10;
                volume = {
                    id: item.volumeId,
                    weight: weight,
                    price: basePrice * multiplier
                };
            }
        }

        let unitPrice = 0;
        if (volume?.price) {
            unitPrice = Number(volume.price);
        } else {
            // Fallback price logic if volume price is missing
            const weight = volume?.weight || 0;
            const basePrice = Number(product.base_price || 0);
            unitPrice = (basePrice / 100) * weight;
        }

        // Final sanity check for price
        if (isNaN(unitPrice) || unitPrice <= 0) {
            console.error(`[OrderService] Invalid price calculated for product ${item.productId}:`, {
                unitPrice,
                volume,
                productBasePrice: product.base_price
            });
            unitPrice = Number(product.base_price || 0); // Last resort fallback
        }

        return {
            ...item,
            price: unitPrice,
            volume: volume || { id: item.volumeId, price: unitPrice } 
        };
    });

    console.log("[OrderService] Creating order with payload:", {
        customerId: input.customerId,
        itemCount: itemsWithData.length,
        itemsSummary: itemsWithData.map(i => ({ id: i.productId, price: i.price, qty: i.quantity }))
    });

    // Call Supabase RPC for atomic transaction via direct SQL
    const JSONItems = JSON.stringify(itemsWithData);
    const [result] = await sql`
        SELECT create_order(
            ${input.customerId}::UUID, 
            ${JSONItems}::JSONB, 
            ${input.wilayaName || null}, 
            ${input.wilayaNumber || null}, 
            ${input.notes || "Order placed successfully."}
        ) as order_id
    `;

    const orderId = result.order_id;

    (revalidateTag as any)(`orders:${input.customerId}`);
    (revalidateTag as any)("orders");

    // Fetch the created order for mapping
    const order = await getOrderById(orderId);
    if (!order) throw new Error("Order created but could not be retrieved");

    try {
        await notifyNewOrder(order.id, order.customer?.shopName || "Customer", order.totalPrice);
    } catch (e) {
        console.error("Notification error:", e);
    }

    return order;
};

// ── READ ──────────────────────────────────────────────────────────────────
export const getOrders = async (limit = 50, startAfterStr?: string): Promise<Order[]> => {
    try {
        const data = await sql`
            SELECT 
                o.*,
                c.id as customer_id, c.shop_name as customer_shop_name,
                (
                    SELECT json_agg(json_build_object(
                        'id', oi.id,
                        'product_id', oi.product_id,
                        'quantity', oi.quantity,
                        'price', oi.price,
                        'volume_id', oi.volume_id,
                        'volume_data', oi.volume_data,
                        'products', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
                    ))
                    FROM order_items oi WHERE oi.order_id = o.id
                ) as order_items,
                (SELECT row_to_json(c) FROM customers c WHERE c.id = o.customer_id) as customers
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            ${startAfterStr ? sql`WHERE o.created_at < ${startAfterStr}` : sql``}
            ORDER BY o.created_at DESC
            LIMIT ${limit}
        `;

        return (data || []).map(mapOrder);
    } catch (err) {
        console.error("Orders fetch error (getOrders):", err);
        return [];
    }
};

export const getOrderById = async (id: string): Promise<Order | null> => {
    try {
        const [data] = await sql`
            SELECT 
                o.*,
                (
                    SELECT json_agg(json_build_object(
                        'id', oi.id,
                        'product_id', oi.product_id,
                        'quantity', oi.quantity,
                        'price', oi.price,
                        'volume_id', oi.volume_id,
                        'volume_data', oi.volume_data,
                        'products', (SELECT row_to_json(p) FROM products p WHERE p.id = oi.product_id)
                    ))
                    FROM order_items oi WHERE oi.order_id = o.id
                ) as order_items,
                (SELECT row_to_json(c) FROM customers c WHERE c.id = o.customer_id) as customers
            FROM orders o
            WHERE o.id = ${id}
            LIMIT 1
        `;

        if (!data) return null;
        return mapOrder(data);
    } catch (err) {
        console.error("Order fetch error (getOrderById):", err);
        return null;
    }
};

export const countOrdersByCustomer = (customerId: string): Promise<number> => {
    return unstable_cache(
        async () => {
            try {
                const { count, error } = await supabaseAdmin
                    .from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('customer_id', customerId);
                
                if (error) throw error;
                return count || 0;
            } catch (err) {
                console.error("Order fetch error (countOrdersByCustomer):", err);
                return 0;
            }
        },
        [`orders-count-${customerId}`],
        { tags: [`orders:${customerId}`], revalidate: 3600 }
    )();
};

export const getOrdersByCustomer = (customerId: string, limit = 50, skip = 0): Promise<Order[]> => {
    return unstable_cache(
        async () => {
            try {
                const { data, error } = await supabaseAdmin
                    .from('orders')
                    .select('*, order_items(*, products(*))')
                    .eq('customer_id', customerId)
                    .order('created_at', { ascending: false })
                    .range(skip, skip + limit - 1);

                if (error) throw error;
                return (data || []).map(mapOrder);
            } catch (err) {
                console.error("Order fetch error (getOrdersByCustomer):", err);
                return [];
            }
        },
        [`orders-${customerId}-${limit}-${skip}`],
        { tags: [`orders:${customerId}`, "orders"], revalidate: 3600 }
    )();
};

export const updateOrderStatus = async (orderId: string, status: string, changedBy: string = "ADMIN", message?: string) => {
    const [order] = await sql`SELECT * FROM orders WHERE id = ${orderId}`;
    if (!order) throw new Error("Order not found");
    
    const logs = order.logs || [];
    logs.push({
        status,
        changedBy,
        message: message || `Status changed to ${status}`,
        createdAt: new Date().toISOString(),
    });

    const updateData: any = { status, logs };

    // STOCK RETURN ON CANCELLATION
    if (status === "CANCELLED" && order.status !== "CANCELLED") {
        try {
            const items = await sql`SELECT * FROM order_items WHERE order_id = ${orderId}`;
            if (items && items.length > 0) {
                for (const item of items) {
                    try {
                        const weight = item.volume_data?.weight || parseInt((item.volume_id || "").replace(/\D/g, "")) || 0;
                        const totalReturn = weight * (item.quantity || 1);
                        if (totalReturn > 0) {
                            // Fetch current stock
                            const [p] = await sql`SELECT stock FROM products WHERE id = ${item.product_id}`;
                            if (p) {
                                await sql`UPDATE products SET stock = ${Number(p.stock || 0) + totalReturn} WHERE id = ${item.product_id}`;
                            }
                        }
                    } catch (itemErr) {
                        console.error(`Failed to return stock for item ${item.id}`, itemErr);
                    }
                }
            }
        } catch (err) {
            console.error("Failed to process stock return on cancel", err);
        }
    }

    // AUTOMATION: If status is SHIPPED or DELIVERED, update payment if not yet paid, and generate invoice
    if (status === OrderStatus.SHIPPED || status === OrderStatus.DELIVERED) {
        if (!order.payment_status || order.payment_status === "UNPAID") {
            updateData.payment_status = "SHIPPED_UNPAID";
        }
        
        // Trigger invoice generation asynchronously
        import("@/services/invoice-service").then(m => m.createInvoice(orderId, Number(order.total_price))).catch(err => {
            console.error("Auto-invoice generation failed:", err);
            import("@/services/audit-service").then(m => m.logSystemError({
                message: `Auto-invoice failed for order ${orderId}: ${err.message}`,
                path: "order-service.updateOrderStatus",
                method: "AUTO"
            }));
        });
    }

    const [updatedOrder] = await sql`
        UPDATE orders SET ${sql(updateData)}
        WHERE id = ${orderId}
        RETURNING *
    `;

    if (!updatedOrder) throw new Error("Order update failed");

    // Fetch details for mapOrder
    const finalOrder = await getOrderById(orderId);
    if (!finalOrder) throw new Error("Order update returned no data");

    (revalidateTag as any)("orders");
    return finalOrder;
};

export const updateOrderShipping = async (orderId: string, data: {
    shippingCompany?: string;
    trackingNumber?: string;
    shippingDate?: Date;
}) => {
    const shipping = {
        company: data.shippingCompany,
        trackingNumber: data.trackingNumber,
        date: (data.shippingDate || new Date()).toISOString(),
    };

    await sql`UPDATE orders SET shipping = ${JSON.stringify(shipping)}::JSONB WHERE id = ${orderId}`;

    (revalidateTag as any)("orders");
    return { success: true };
};

export const getReorderItems = async (orderId: string): Promise<any[]> => {
    const data = await sql`
        SELECT oi.*, p.name as product_name
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ${orderId}
    `;
    
    return (data || []).map((item: any) => ({
        productId: item.product_id,
        quantity: item.quantity,
        volumeId: item.volume_id,
        name: item.product_name || "Product",
    }));
};
