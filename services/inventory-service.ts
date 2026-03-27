import { sql } from "@/lib/db";

// ── STOCK ADJUSTMENTS ─────────────────────────────────────────────────────
export const decrementStock = async (productId: string, quantity: number, weight: number = 100) => {
    const totalWeight = quantity * weight;
    
    // Direct SQL update with stock_weight
    const [product] = await sql`
        UPDATE products 
        SET stock_weight = stock_weight - ${totalWeight},
            stock = stock - ${totalWeight}
        WHERE id = ${productId}
        RETURNING stock_weight, stock
    `;

    // Log the change
    await sql`
        INSERT INTO inventory_logs (product_id, change_type, quantity, reason, source)
        VALUES (${productId}, 'DECREMENT_STOCK', ${-totalWeight}, 'Order decrement', 'SYSTEM')
    `;

    return { id: productId, stock: product.stock_weight };
};

export const incrementStock = async (productId: string, quantity: number, weight: number = 100) => {
    const totalWeight = quantity * weight;
    
    const [product] = await sql`
        UPDATE products 
        SET stock_weight = stock_weight + ${totalWeight},
            stock = stock + ${totalWeight}
        WHERE id = ${productId}
        RETURNING stock_weight, stock
    `;

    await sql`
        INSERT INTO inventory_logs (product_id, change_type, quantity, reason, source)
        VALUES (${productId}, 'INCREMENT_STOCK', ${totalWeight}, 'Manual increment', 'SYSTEM')
    `;

    return { id: productId, stock: product.stock_weight };
};

// ── STOCK QUERIES ─────────────────────────────────────────────────────────
export const getStockLevel = async (productId: string) => {
    try {
        const [data] = await sql`SELECT id, name, stock_weight FROM products WHERE id = ${productId} LIMIT 1`;
        if (!data) return null;
        return { id: data.id, name: data.name, stock: data.stock_weight };
    } catch (err) {
        console.error("Inventory fetch error (getStockLevel):", err);
        return null;
    }
};

export const getLowStockProducts = async (threshold = 500) => {
    try {
        const products = await sql`
            SELECT * FROM products 
            WHERE stock_weight <= ${threshold}
            ORDER BY stock_weight ASC
        `;
        return (products || []).map(p => ({
            ...p,
            stock: p.stock_weight
        }));
    } catch (err) {
        console.error("Inventory fetch error (getLowStockProducts):", err);
        return [];
    }
};

// ── ADMIN ADJUSTMENTS ─────────────────────────────────────────────────────
export const adjustStock = async (
    productId: string,
    weightAmount: number, // can be positive or negative
    reason: string
) => {
    const [product] = await sql`
        UPDATE products 
        SET stock_weight = stock_weight + ${weightAmount},
            stock = stock + ${weightAmount}
        WHERE id = ${productId}
        RETURNING *
    `;

    await sql`
        INSERT INTO inventory_logs (product_id, change_type, quantity, reason, source)
        VALUES (${productId}, ${weightAmount > 0 ? 'INCREMENT' : 'DECREMENT'}, ${weightAmount}, ${reason}, 'ADMIN')
    `;

    return { ...product, stock: product.stock_weight };
};

// ── HISTORY ───────────────────────────────────────────────────────────────
export const getInventoryHistory = async (filters?: { productId?: string; changeType?: string }) => {
    try {
        const logs = await sql`
            SELECT l.*, p.name as product_name, p.brand as product_brand, p.image_url as product_image_url
            FROM inventory_logs l
            LEFT JOIN products p ON l.product_id = p.id
            WHERE 1=1
            ${filters?.productId ? sql`AND l.product_id = ${filters.productId}` : sql``}
            ${filters?.changeType ? sql`AND l.change_type = ${filters.changeType}` : sql``}
            ORDER BY l.created_at DESC
        `;
        
        return (logs || []).map(log => ({
            id: log.id,
            productId: log.product_id,
            changeType: log.change_type,
            quantity: log.quantity,
            source: log.source,
            reason: log.reason,
            createdAt: new Date(log.created_at),
            product: log.product_name ? {
                name: log.product_name,
                brand: log.product_brand,
                imageUrl: log.product_image_url
            } : null
        }));
    } catch (err) {
        console.error("Inventory history fetch error:", err);
        return [];
    }
};
