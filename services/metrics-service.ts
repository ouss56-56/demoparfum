import { sql } from "@/lib/db";

export interface DashboardMetrics {
    totalRevenue: number;
    unpaidBalance: number;
    dailyRevenue: number;
    monthlyRevenue: number;
    totalOrders: number;
    pendingOrders: number;
    customersCount: number;
    productsCount: number;
    totalProfit: number;
}

export const getAdminMetrics = async (): Promise<DashboardMetrics> => {
    const [result] = await sql`
        SELECT 
            COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total_price ELSE 0 END), 0) as total_revenue,
            COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN (total_price - amount_paid) ELSE 0 END), 0) as unpaid_balance,
            COALESCE(SUM(CASE WHEN status != 'CANCELLED' AND created_at >= CURRENT_DATE THEN total_price ELSE 0 END), 0) as daily_revenue,
            COALESCE(SUM(CASE WHEN status != 'CANCELLED' AND created_at >= date_trunc('month', CURRENT_DATE) THEN total_price ELSE 0 END), 0) as monthly_revenue,
            COUNT(*) as total_orders,
            COUNT(*) FILTER (WHERE status = 'PENDING') as pending_orders,
            (SELECT COUNT(*) FROM customers) as customers_count,
            (SELECT COUNT(*) FROM products) as products_count
        FROM orders
    `;

    return {
        totalRevenue: Number(result.total_revenue),
        unpaidBalance: Number(result.unpaid_balance),
        dailyRevenue: Number(result.daily_revenue),
        monthlyRevenue: Number(result.monthly_revenue),
        totalOrders: Number(result.total_orders),
        pendingOrders: Number(result.pending_orders),
        customersCount: Number(result.customers_count),
        productsCount: Number(result.products_count),
        totalProfit: 0, // Calculated separately with cost
    };
};

export const getCustomerMetrics = async (customerId: string) => {
    const [result] = await sql`
        SELECT 
            COUNT(*) as total_orders,
            COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN total_price ELSE 0 END), 0) as total_spent,
            COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN (total_price - amount_paid) ELSE 0 END), 0) as balance_due
        FROM orders
        WHERE customer_id = ${customerId}
    `;

    return {
        totalOrders: Number(result.total_orders),
        totalSpent: Number(result.total_spent),
        balanceDue: Number(result.balance_due),
    };
};
