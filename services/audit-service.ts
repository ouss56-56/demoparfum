import { sql } from "@/lib/db";

// ── LOGGING ─────────────────────────────────────────────────────────────────
export const logAdminAction = async (data: {
    adminId: string;
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
}) => {
    try {
        await sql`
            INSERT INTO admin_logs (admin_id, action, target_type, target_id, metadata)
            VALUES (${data.adminId}, ${data.action}, ${data.targetType}, ${data.targetId || null}, ${JSON.stringify(data.metadata || {})}::jsonb)
        `;
    } catch (e) {
        console.error("Failed to log admin action:", e);
    }
};

export const logSystemError = async (data: {
    message: string;
    path?: string;
    method?: string;
    stackTrace?: string;
    metadata?: Record<string, unknown>;
}) => {
    try {
        await sql`
            INSERT INTO system_errors (message, path, method, stack_trace, metadata)
            VALUES (${data.message}, ${data.path || null}, ${data.method || null}, ${data.stackTrace || null}, ${JSON.stringify(data.metadata || {})}::jsonb)
        `;
    } catch (e) {
        console.error("Failed to log system error:", e);
    }
};

// ── READ LOGS ─────────────────────────────────────────────────────────────
export const getAdminLogs = async (limit = 100) => {
    try {
        const data = await sql`
            SELECT * FROM admin_logs
            ORDER BY created_at DESC
            LIMIT ${limit}
        `;

        return (data || []).map((log: any) => ({
            id: log.id,
            adminId: log.admin_id,
            action: log.action,
            targetType: log.target_type,
            targetId: log.target_id,
            metadata: log.metadata,
            createdAt: new Date(log.created_at),
            admin: { name: 'Admin', email: '' }
        }));
    } catch (e) {
        console.error("getAdminLogs failed:", e);
        return [];
    }
};

export const getSystemErrors = async (limit = 100) => {
    try {
        const data = await sql`
            SELECT * FROM system_errors
            ORDER BY created_at DESC
            LIMIT ${limit}
        `;

        return (data || []).map((err: any) => ({
            id: err.id,
            ...err,
            createdAt: new Date(err.created_at),
            stackTrace: err.stack_trace
        }));
    } catch (e) {
        console.error("getSystemErrors failed:", e);
        return [];
    }
};

// ── SYSTEM HEALTH DASHBOARD ───────────────────────────────────────────────
export const getSystemHealth = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
        const [
            [productsCount],
            [customersCount],
            [ordersCount],
            [ordersToday],
            [recentErrors],
            lowStockData
        ] = await Promise.all([
            sql`SELECT COUNT(*) as count FROM products`,
            sql`SELECT COUNT(*) as count FROM customers`,
            sql`SELECT COUNT(*) as count FROM orders`,
            sql`SELECT COUNT(*) as count FROM orders WHERE created_at >= ${today.toISOString()}`,
            sql`SELECT COUNT(*) as count FROM system_errors WHERE created_at >= ${yesterday.toISOString()}`,
            sql`SELECT stock_weight FROM products WHERE stock_weight > 0`
        ]);

        let lowStockProducts = 0;
        (lowStockData || []).forEach((p: any) => {
            if (Number(p.stock_weight) <= 500) lowStockProducts++;
        });

        const errorCount = Number(recentErrors?.count || 0);

        return {
            metrics: {
                totalProducts: Number(productsCount?.count || 0),
                totalCustomers: Number(customersCount?.count || 0),
                totalOrders: Number(ordersCount?.count || 0),
                ordersToday: Number(ordersToday?.count || 0),
            },
            inventory: {
                lowStockProducts,
                deadProducts: 0,
            },
            stability: {
                recentErrors24h: errorCount,
                status: errorCount > 10 ? "DEGRADED" : errorCount > 0 ? "WARNING" : "HEALTHY",
            }
        };
    } catch (e) {
        console.error("System health check failed", e);
        return {
            metrics: { totalProducts: 0, totalCustomers: 0, totalOrders: 0, ordersToday: 0 },
            inventory: { lowStockProducts: 0, deadProducts: 0 },
            stability: { recentErrors24h: 0, status: "UNKNOWN" }
        };
    }
};
