import { sql } from "@/lib/db";

// ── CREATE NOTIFICATION ───────────────────────────────────────────────────
export const createNotification = async (
    type: string,
    title: string,
    message: string,
    metadata?: Record<string, any>
) => {
    const userId = metadata?.userId || null;
    const [notification] = await sql`
        INSERT INTO notifications (type, title, message, metadata, is_read, user_id)
        VALUES (${type}, ${title}, ${message}, ${metadata ? JSON.stringify(metadata) : null}::JSONB, false, ${userId})
        RETURNING *
    `;

    return { ...notification, id: notification.id, isRead: notification.is_read };
};

// ── GET ALL NOTIFICATIONS ────────────────────────────────────────────────
export const getNotifications = async (userId: string | null = null, limit = 30) => {
    try {
        const data = userId 
            ? await sql`SELECT * FROM notifications WHERE user_id = ${userId} OR user_id IS NULL ORDER BY created_at DESC LIMIT ${limit}`
            : await sql`SELECT * FROM notifications WHERE user_id IS NULL ORDER BY created_at DESC LIMIT ${limit}`;

        return (data || []).map(n => ({
            id: n.id,
            ...n,
            isRead: n.is_read,
            createdAt: n.created_at ? new Date(n.created_at) : new Date()
        }));
    } catch (e) {
        console.error("getNotifications error:", e);
        return [];
    }
};

// ── GET UNREAD COUNT ─────────────────────────────────────────────────────
export const getUnreadCount = async (userId: string | null = null) => {
    try {
        const [result] = userId
            ? await sql`SELECT COUNT(*) as count FROM notifications WHERE is_read = false AND (user_id = ${userId} OR user_id IS NULL)`
            : await sql`SELECT COUNT(*) as count FROM notifications WHERE is_read = false AND user_id IS NULL`;
        return Number(result.count) || 0;
    } catch (e) {
        console.error("Notification getUnreadCount error:", e);
        return 0;
    }
};

// ── MARK AS READ ─────────────────────────────────────────────────────────
export const markAsRead = async (id: string) => {
    await sql`
        UPDATE notifications SET is_read = true WHERE id = ${id}
    `;
    return { id, isRead: true };
};

// ── MARK ALL AS READ ─────────────────────────────────────────────────────
export const markAllAsRead = async () => {
    const result = await sql`
        UPDATE notifications SET is_read = true WHERE is_read = false
        RETURNING id
    `;
    return { count: result.length || 0 };
};

// ── TRIGGER HELPERS ──────────────────────────────────────────────────────
export const notifyNewOrder = async (orderId: string, customerName: string, total: number) => {
    return await createNotification(
        "NEW_ORDER",
        "New Order Received",
        `${customerName} placed an order worth ${total.toFixed(2)} DZD.`,
        { orderId }
    );
};

export const notifyLowStock = async (productId: string, productName: string, stock: number) => {
    return await createNotification(
        "LOW_STOCK",
        "Low Stock Alert",
        `"${productName}" is running low — only ${stock} units remaining.`,
        { productId }
    );
};

export const notifyNewCustomer = async (customerId: string, shopName: string) => {
    return await createNotification(
        "NEW_CUSTOMER",
        "New Customer Registered",
        `${shopName} has just registered as a new B2B customer.`,
        { customerId }
    );
};

export const NotificationService = {
    createNotification,
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    notifyNewOrder,
    notifyLowStock,
    notifyNewCustomer
};
