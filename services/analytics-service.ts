import { sql } from "@/lib/db";

// ── PRODUCT PERFORMANCE & DEMAND FORECAST ─────────────────────────────────
export const getProductAnalytics = async () => {
  try {
    const products = await sql`
        SELECT id, name, brand, image_url, base_price, stock_weight 
        FROM products
    `;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch order items from last 30 days
    const recentOrderItems = await sql`
        SELECT oi.product_id, SUM(oi.quantity) as total_qty
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status != 'CANCELLED' AND o.created_at >= ${thirtyDaysAgo.toISOString()}
        GROUP BY oi.product_id
    `;

    const recentDemandMap = new Map<string, number>();
    (recentOrderItems || []).forEach((item: any) => {
        recentDemandMap.set(item.product_id, Number(item.total_qty || 0));
    });

    const getDemandLabel = (qty: number) => {
        if (qty > 50) return "High Demand";
        if (qty >= 20) return "Medium Demand";
        return "Low Demand";
    };

    return (products || []).map((p: any) => {
        const recentQty = recentDemandMap.get(p.id) || 0;
        return {
            id: p.id,
            name: p.name || "",
            brand: p.brand || "",
            imageUrl: p.image_url,
            totalUnitsSold: recentQty,
            totalRevenue: 0,
            recentUnits30d: recentQty,
            demandForecast: getDemandLabel(recentQty),
        };
    });
  } catch (e) {
    console.error("getProductAnalytics failed:", e);
    return [];
  }
};

// ── REVENUE ANALYTICS ─────────────────────────────────────────────────────
export const getRevenueMetrics = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const validOrders = await sql`
        SELECT total_price, created_at 
        FROM orders 
        WHERE status != 'CANCELLED'
        ORDER BY created_at ASC
    `;

    const dailyMap = new Map<string, { revenue: number, orders: number }>();
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dailyMap.set(dateStr, { revenue: 0, orders: 0 });
    }

    const monthlyMap = new Map<string, number>();

    (validOrders || []).forEach((order: any) => {
        const createdAt = new Date(order.created_at);
        const dStr = createdAt.toISOString().split('T')[0];
        const mStr = createdAt.toISOString().slice(0, 7); // YYYY-MM
        const amount = Number(order.total_price || 0);

        if (createdAt >= thirtyDaysAgo) {
            if (dailyMap.has(dStr)) {
                const current = dailyMap.get(dStr)!;
                dailyMap.set(dStr, { revenue: current.revenue + amount, orders: current.orders + 1 });
            }
        }

        monthlyMap.set(mStr, (monthlyMap.get(mStr) || 0) + amount);
    });

    const dailyRevenue = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        revenue: data.revenue,
        orders: data.orders
    }));

    const monthlyRevenue = Array.from(monthlyMap.entries()).map(([month, revenue]) => ({
        month,
        revenue
    }))
    .sort((a: any, b: any) => a.month.localeCompare(b.month))
    .slice(-12);

    return { dailyRevenue, monthlyRevenue };
  } catch (e) {
    console.error("getRevenueMetrics failed:", e);
    return { dailyRevenue: [], monthlyRevenue: [] };
  }
};

// ── TOP CUSTOMERS ─────────────────────────────────────────────────────────
export const getTopCustomers = async (limit = 10) => {
  try {
    const customers = await sql`
        SELECT id, name, shop_name, phone 
        FROM customers
    `;

    const orders = await sql`
        SELECT customer_id, total_price 
        FROM orders 
        WHERE status != 'CANCELLED'
    `;
        
    const customerSpentMap = new Map<string, { totalSpent: number, count: number }>();
    (orders || []).forEach((order: any) => {
        if (order.customer_id) {
            const current = customerSpentMap.get(order.customer_id) || { totalSpent: 0, count: 0 };
            customerSpentMap.set(order.customer_id, {
                totalSpent: current.totalSpent + Number(order.total_price || 0),
                count: current.count + 1
            });
        }
    });

    return (customers || []).map((c: any) => {
        const stats = customerSpentMap.get(c.id) || { totalSpent: 0, count: 0 };
        return {
            id: c.id,
            name: c.name || "Unknown",
            shopName: c.shop_name || "Customer",
            phone: c.phone || "",
            orderCount: stats.count,
            totalSpent: stats.totalSpent
        };
    })
    .filter((c: any) => c.totalSpent > 0)
    .sort((a: any, b: any) => b.totalSpent - a.totalSpent)
    .slice(0, limit);
  } catch (e) {
    console.error("getTopCustomers failed:", e);
    return [];
  }
};

// ── EXPORTS ───────────────────────────────────────────────────────────────
export const exportOrdersReport = async (dateFrom?: string, dateTo?: string) => {
    try {
        const query = sql`
            SELECT o.id, o.created_at, o.total_price, o.status, c.name as customer_name, c.shop_name
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE 1=1
            ${dateFrom ? sql`AND o.created_at >= ${dateFrom}` : sql``}
            ${dateTo ? sql`AND o.created_at <= ${dateTo}` : sql``}
            ORDER BY o.created_at DESC
        `;

        const data = await query;
        
        // Manual CSV generation
        const header = ["Order ID", "Date", "Customer", "Shop", "Total", "Status"].join(",");
        const rows = (data || []).map((o: any) => [
            o.id,
            new Date(o.created_at).toISOString(),
            o.customer_name || "N/A",
            o.shop_name || "N/A",
            o.total_price,
            o.status
        ].join(","));

        return [header, ...rows].join("\n");
    } catch (e) {
        console.error("exportOrdersReport failed:", e);
        throw e;
    }
};
