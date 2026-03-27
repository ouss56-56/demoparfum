import { sql } from "@/lib/db";

// ── SMART RESTOCK SYSTEM ──────────────────────────────────────────────────
export const getRestockSuggestions = async () => {
  try {
    const products = await sql`SELECT * FROM products`;
    if (!products) return [];

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentOrders = await sql`
        SELECT 
            o.id as order_id,
            oi.product_id,
            oi.quantity,
            oi.volume_data
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status != 'CANCELLED'
        AND o.created_at >= ${thirtyDaysAgo.toISOString()}
    `;

    if (!recentOrders) return [];

    const recentDemandMap = new Map<string, number>();
    recentOrders.forEach((item: any) => {
        const weight = (item.volume_data as any)?.weight || 100;
        const totalWeight = (item.quantity || 0) * weight;
        recentDemandMap.set(item.product_id, (recentDemandMap.get(item.product_id) || 0) + totalWeight);
    });

    return (products || []).map((product: any) => {
        const weightSold30d = recentDemandMap.get(product.id) || 0;
        const avgDailyWeightSales = weightSold30d / 30;

        const currentStock = Number(product.stock ?? product.stock_weight ?? 0);
        const estimatedDaysLeft = avgDailyWeightSales > 0 ? Math.floor(currentStock / avgDailyWeightSales) : 999;

        const lowStockThreshold = 500; // Simplified internal threshold

        let recommendation = "Healthy";
        let status = "NORMAL";
        if (currentStock <= lowStockThreshold || estimatedDaysLeft < 7) {
            recommendation = "Restock Soon";
            status = "WARNING";
            if (currentStock === 0) {
                recommendation = "Restock Immediately (OOS)";
                status = "CRITICAL";
            }
        } else if (estimatedDaysLeft > 60 && currentStock > 5000) { 
            recommendation = "Overstock";
            status = "INFO";
        } else if (avgDailyWeightSales === 0 && currentStock > 0) {
            recommendation = "No Recent Sales";
            status = "INFO";
        }

        return {
            id: product.id,
            name: product.name,
            brand: product.brand,
            imageUrl: product.image_url,
            currentStockWeight: currentStock,
            weightSold30d,
            avgDailyWeightSales: Number(avgDailyWeightSales.toFixed(2)),
            estimatedDaysLeft,
            recommendation,
            status
        };
    }).sort((a: any, b: any) => a.estimatedDaysLeft - b.estimatedDaysLeft);
  } catch (e) {
    console.error("getRestockSuggestions failed:", e);
    return [];
  }
};

// ── DEAD STOCK DETECTION ──────────────────────────────────────────────────
export const getDeadStock = async () => {
  try {
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const recentOrders = await sql`
        SELECT oi.product_id
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status != 'CANCELLED'
        AND o.created_at >= ${sixtyDaysAgo.toISOString()}
    `;

    if (!recentOrders) return [];

    const activeProductIds = new Set<string>();
    recentOrders.forEach((item: any) => activeProductIds.add(item.product_id));

    const products = await sql`
        SELECT * FROM products WHERE stock > 0
    `;

    if (!products) return [];
    
    const deadProducts = (products || [])
        .filter((p: any) => !activeProductIds.has(p.id));

    return deadProducts.map((p: any) => {
        const basePrice = Number(p.base_price || 0);
        const stock_weight = p.stock_weight || 0;
        const createdAt = new Date(p.created_at);
        
        const valueTieUp = basePrice * (stock_weight / 100); 
        return {
            ...p,
            stock: stock_weight,
            valueTieUp,
            daysSinceAdded: Math.floor((new Date().getTime() - createdAt.getTime()) / (1000 * 3600 * 24))
        };
    }).filter((p: any) => p.daysSinceAdded > 60) 
        .sort((a: any, b: any) => b.valueTieUp - a.valueTieUp);
  } catch (e) {
    console.error("getDeadStock failed:", e);
    return [];
  }
};

// ── PROFIT ANALYTICS ──────────────────────────────────────────────────────
export const getProfitAnalytics = async () => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const validOrders = await sql`
        SELECT o.*, 
            json_agg(oi.*) as order_items
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status != 'CANCELLED'
        GROUP BY o.id
    `;

    if (!validOrders) return { dailyProfit: [], globalMarginPercent: 0, overallProfit: 0, topProfitableProducts: [] };

    const dailyMap = new Map<string, { revenue: number, cost: number, profit: number }>();
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        dailyMap.set(dateStr, { revenue: 0, cost: 0, profit: 0 });
    }

    let overallRevenue = 0;
    let overallCost = 0; 

    validOrders?.forEach((order: any) => {
        const createdAt = new Date(order.created_at);
        const dStr = createdAt.toISOString().split('T')[0];

        let orderRevenue = Number(order.total_price || 0);
        let orderCost = 0;

        order.order_items?.forEach((item: any) => {
            orderCost += (Number(item.price || 0) * 0.7) * (item.quantity || 0);
        });

        const orderProfit = orderRevenue - orderCost;
        overallRevenue += orderRevenue;
        overallCost += orderCost;

        if (createdAt >= thirtyDaysAgo) {
            if (dailyMap.has(dStr)) {
                const current = dailyMap.get(dStr)!;
                dailyMap.set(dStr, {
                    revenue: current.revenue + orderRevenue,
                    cost: current.cost + orderCost,
                    profit: current.profit + orderProfit
                });
            }
        }
    });

    const dailyProfit = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        revenue: data.revenue,
        cost: data.cost,
        profit: data.profit,
        marginPercent: data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0
    }));

    const globalMarginPercent = overallRevenue > 0 ? ((overallRevenue - overallCost) / overallRevenue) * 100 : 0;

    const products = await sql`
        SELECT id, name, image_url, base_price FROM products LIMIT 10
    `;

    const productsProfit = (products || []).map((p: any) => {
        const basePrice = Number(p.base_price || 0);
        const unitProfit = basePrice * 0.3;
        return {
            id: p.id,
            name: p.name || "",
            imageUrl: p.image_url,
            totalProfit: unitProfit,
            marginPercent: 30,
            unitsSold: 0
        };
    });

    return {
        dailyProfit,
        globalMarginPercent,
        overallProfit: overallRevenue - overallCost,
        topProfitableProducts: productsProfit
    };
  } catch (e) {
    console.error("getProfitAnalytics failed:", e);
    return { dailyProfit: [], globalMarginPercent: 0, overallProfit: 0, topProfitableProducts: [] };
  }
};

// ── INVENTORY HEALTH SCORE ────────────────────────────────────────────────
export const getInventoryHealthScore = async () => {
    let score = 100;
    const products = await sql`SELECT stock FROM products`.catch(() => []);
    if (!products || products.length === 0) return 100;

    const lowStockCount = products.filter((p: any) => Number(p.stock || 0) <= 500).length;
    score -= (lowStockCount * 2); 

    const deadStock = await getDeadStock();
    score -= (deadStock.length * 5); 

    const oosCount = products.filter((p: any) => Number(p.stock || 0) === 0).length;
    score -= (oosCount * 5); 

    return Math.max(0, score);
};

// ── SMART ALERTS ──────────────────────────────────────────────────────────
export const getSmartAlerts = async () => {
    const alerts = [];
    const healthScore = await getInventoryHealthScore();
    if (healthScore < 50) {
        alerts.push({ type: "CRITICAL", message: `Inventory Health Score is critically low (${healthScore}%). Immediate action required.` });
    }

    const restock = await getRestockSuggestions();
    const urgentRestock = restock.filter((r: any) => r.status === "CRITICAL");
    if (urgentRestock.length > 0) {
        alerts.push({ type: "WARNING", message: `${urgentRestock.length} products are out of stock and need immediate restocking.` });
    }

    const deadStock = await getDeadStock();
    if (deadStock.length > 0) {
        alerts.push({ type: "INFO", message: `${deadStock.length} products have seen zero sales in 60+ days.` });
    }

    return alerts;
};

export const getIntelligenceStats = async () => {
    const [healthScore, alerts, profitSnapshot] = await Promise.all([
        getInventoryHealthScore(),
        getSmartAlerts(),
        getProfitAnalytics()
    ]);

    return {
        success: true,
        data: {
            healthScore,
            alerts,
            profitSnapshot: {
                dailyProfit: profitSnapshot.dailyProfit,
                globalMarginPercent: profitSnapshot.globalMarginPercent,
                overallProfit: profitSnapshot.overallProfit,
                topProfitableProducts: profitSnapshot.topProfitableProducts
            }
        }
    };
};

export const IntelligenceService = {
    getRestockSuggestions,
    getDeadStock,
    getProfitAnalytics,
    getInventoryHealthScore,
    getSmartAlerts,
    getIntelligenceStats
};
