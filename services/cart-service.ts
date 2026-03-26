import { sql } from "@/lib/db";

// ── READ ──────────────────────────────────────────────────────────────────
export const getCart = async (customerId: string) => {
    try {
        const [cart] = await sql`
            SELECT * FROM carts WHERE customer_id = ${customerId} LIMIT 1
        `;

        if (!cart) return { items: [], totalPrice: 0 };
        
        const items = cart.items || [];
        if (items.length === 0) return { id: customerId, customerId, items: [], totalPrice: 0 };

        // Enrich items with product data
        const productIds = [...new Set(items.map((i: any) => i.productId))];
        const products = await sql`
            SELECT * FROM products WHERE id = ANY(${productIds as any})
        `;

        const productsMap = new Map((products || []).map((p: any) => [p.id, p]));
        let totalPrice = 0;

        const enrichedItems = items.map((item: any) => {
            const product = productsMap.get(item.productId);
            if (!product) return null;
            
            let volumeData: any = null;
            let unitPrice = 0;

            if (item.volumeId && product.volumes) {
                volumeData = product.volumes.find((v: any) => v.id === item.volumeId);
                if (volumeData) {
                    unitPrice = Number(volumeData.price);
                }
            }
            
            if (!volumeData) {
                // Fallback pricing if volume is missing
                const weight = parseInt((item.volumeId || "").replace(/\D/g, "")) || 100;
                unitPrice = (Number(product.base_price || 0) / 100) * weight;
            }

            const lineTotal = unitPrice * item.quantity;
            totalPrice += lineTotal;

            return {
                id: item.id,
                cartId: customerId,
                productId: item.productId,
                quantity: item.quantity,
                volumeId: item.volumeId,
                unitPrice,
                lineTotal,
                weight: volumeData?.weight || parseInt((item.volumeId || "").replace(/\D/g, "")) || 0,
                product,
                volume: volumeData || { id: item.volumeId, weight: parseInt((item.volumeId || "").replace(/\D/g, "")) || 0 }
            };
        }).filter(Boolean);

        return { 
            id: customerId, 
            customerId, 
            createdAt: new Date(cart.created_at || Date.now()), 
            items: enrichedItems, 
            totalPrice 
        };
    } catch (error) {
        console.error("getCart error:", error);
        return { items: [], totalPrice: 0 };
    }
};

// ── ADD TO CART ───────────────────────────────────────────────────────────
export const addToCart = async (
    customerId: string,
    productId: string,
    quantity: number,
    volumeId: string
) => {
    const [product] = await sql`SELECT * FROM products WHERE id = ${productId} LIMIT 1`;
    if (!product) throw new Error("Product not found");

    const volume = (product.volumes || []).find((v: any) => v.id === volumeId);
    // Note: Allowing missing volume for now if it follows vXXX pattern
    const weight = volume?.weight || parseInt((volumeId || "").replace(/\D/g, "")) || 0;

    const requiredWeight = quantity * weight;
    if (Number(product.stock_weight || 0) < requiredWeight) {
        throw new Error(`Insufficient stock for "${product.name}".`);
    }

    const [cart] = await sql`SELECT * FROM carts WHERE customer_id = ${customerId} LIMIT 1`;

    let items = cart?.items || [];
    const existingIndex = items.findIndex((i: any) => i.productId === productId && i.volumeId === volumeId);

    let updatedItem;
    if (existingIndex > -1) {
        items[existingIndex].quantity += quantity;
        updatedItem = items[existingIndex];
    } else {
        updatedItem = {
            id: crypto.randomUUID(),
            productId,
            quantity,
            volumeId
        };
        items.push(updatedItem);
    }

    if (!cart) {
        await sql`INSERT INTO carts (customer_id, items) VALUES (${customerId}, ${JSON.stringify(items)}::jsonb)`;
    } else {
        await sql`UPDATE carts SET items = ${JSON.stringify(items)}::jsonb WHERE customer_id = ${customerId}`;
    }

    return { ...updatedItem, product, volume: volume || { id: volumeId, weight } };
};

// ── UPDATE CART ITEM ──────────────────────────────────────────────────────
export const updateCartItem = async (cartItemId: string, quantity: number) => {
    // In SQL, we search for the cart containing this item ID in its items JSONB array
    const [foundCart] = await sql`
        SELECT * FROM carts WHERE items @> ${JSON.stringify([{ id: cartItemId }])}::jsonb LIMIT 1
    `;

    if (!foundCart) throw new Error("Cart item not found");

    let items = foundCart.items || [];
    const foundItemIndex = items.findIndex((i: any) => i.id === cartItemId);
    if (foundItemIndex === -1) throw new Error("Item indexed but not found in cart");

    const cartItem = items[foundItemIndex];

    if (quantity <= 0) {
        items.splice(foundItemIndex, 1);
        await sql`UPDATE carts SET items = ${JSON.stringify(items)}::jsonb WHERE id = ${foundCart.id}`;
        return { id: cartItemId };
    }

    const [product] = await sql`SELECT * FROM products WHERE id = ${cartItem.productId} LIMIT 1`;
    if (!product) throw new Error("Product not found");

    let volumeData = (product.volumes || []).find((v: any) => v.id === cartItem.volumeId);
    const weight = volumeData?.weight || parseInt((cartItem.volumeId || "").replace(/\D/g, "")) || 0;
    const requiredWeight = quantity * weight;
    
    if (Number(product.stock_weight || 0) < requiredWeight) {
        throw new Error(`Insufficient stock.`);
    }

    items[foundItemIndex].quantity = quantity;
    await sql`UPDATE carts SET items = ${JSON.stringify(items)}::jsonb WHERE id = ${foundCart.id}`;

    return {
        ...items[foundItemIndex],
        product,
        volume: volumeData || { id: cartItem.volumeId, weight }
    };
};

// ── REMOVE CART ITEM ──────────────────────────────────────────────────────
export const removeCartItem = async (cartItemId: string) => {
    const [foundCart] = await sql`
        SELECT * FROM carts WHERE items @> ${JSON.stringify([{ id: cartItemId }])}::jsonb LIMIT 1
    `;
    if (foundCart) {
        const items = foundCart.items.filter((i: any) => i.id !== cartItemId);
        await sql`UPDATE carts SET items = ${JSON.stringify(items)}::jsonb WHERE id = ${foundCart.id}`;
    }
    return { id: cartItemId };
};

// ── CLEAR CART ────────────────────────────────────────────────────────────
export const clearCart = async (customerId: string) => {
    await sql`UPDATE carts SET items = '[]'::jsonb WHERE customer_id = ${customerId}`;
};
