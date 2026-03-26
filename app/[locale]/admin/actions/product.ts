"use server";

import { sql } from "@/lib/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { logEvent } from "@/lib/logger";

function generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function createProduct(formData: FormData) {
    const slug = generateSlug(formData.get("name") as string) + "-" + Date.now().toString(36);

    const data: any = {
        name: formData.get("name") as string,
        slug,
        brand_id: formData.get("brandId") as string,
        description: formData.get("description") as string,
        category_id: formData.get("categoryId") as string,
        image_url: formData.get("imageUrl") as string,
        base_price: Number(formData.get("basePrice")),
        purchase_price: Number(formData.get("purchasePrice") || 0),
        stock_weight: Number(formData.get("stockWeight")),
        low_stock_threshold: Number(formData.get("lowStockThreshold") || 500),
        status: (formData.get("status") as string) || "ACTIVE",
    };

    const collectionIds = (formData.getAll("collectionIds") as string[]).filter(Boolean);
    const tagIds = (formData.getAll("tagIds") as string[]).filter(Boolean);

    if (!data.name || !data.brand_id || !data.category_id || !data.base_price || isNaN(data.base_price) || data.base_price <= 0) {
        return { success: false, error: "Missing or invalid required fields (name, brandId, categoryId, base_price)" };
    }
    if (data.stock_weight < 0 || isNaN(data.stock_weight)) {
        return { success: false, error: "Stock (g) cannot be negative" };
    }

    data.collection_ids = collectionIds;
    data.tag_ids = tagIds;

    // Sync brand name from brand_id
    if (data.brand_id) {
        const [brandData] = await sql`SELECT name FROM brands WHERE id = ${data.brand_id} LIMIT 1`;
        if (brandData) {
            data.brand = brandData.name;
        }
    }

    try {
        const [product] = await sql`
            INSERT INTO products (name, slug, brand_id, brand, description, category_id, image_url, base_price, purchase_price, stock_weight, low_stock_threshold, status, collection_ids, tag_ids)
            VALUES (${data.name}, ${data.slug}, ${data.brand_id}, ${data.brand || null}, ${data.description}, ${data.category_id}, ${data.image_url}, ${data.base_price}, ${data.purchase_price}, ${data.stock_weight}, ${data.low_stock_threshold}, ${data.status}, ${data.collection_ids}, ${data.tag_ids})
            RETURNING *
        `;

        // Initial stock log
        if (data.stock_weight > 0) {
            await sql`
                INSERT INTO inventory_logs (product_id, change_type, quantity, source, reason)
                VALUES (${product.id}, 'INITIAL_STOCK', ${data.stock_weight}, 'ADMIN', 'Initial stock on product creation')
            `;
        }

        await logEvent("PRODUCT_CREATED", product.id, `Product "${data.name}" created with ${data.stock_weight}g`);
        revalidatePath("/admin/products");
        revalidatePath("/catalog");
        revalidatePath("/");
        (revalidateTag as any)("products");
        (revalidateTag as any)("featured-products");
        (revalidateTag as any)("new-arrivals");
        (revalidateTag as any)("best-sellers");
        return { success: true };
    } catch (error) {
        console.error("Create product error:", error);
        return { success: false, error: "Failed to create product" };
    }
}

export async function updateProduct(id: string, formData: FormData) {
    const data: any = {
        name: formData.get("name") as string,
        brand_id: formData.get("brandId") as string,
        description: formData.get("description") as string,
        category_id: formData.get("categoryId") as string,
        image_url: formData.get("imageUrl") as string,
        base_price: Number(formData.get("basePrice")),
        purchase_price: Number(formData.get("purchasePrice") || 0),
        stock_weight: Number(formData.get("stockWeight")),
        low_stock_threshold: Number(formData.get("lowStockThreshold") || 500),
        status: (formData.get("status") as string) || "ACTIVE",
    };

    // Sync brand name from brand_id
    if (data.brand_id) {
        const [brandData] = await sql`SELECT name FROM brands WHERE id = ${data.brand_id} LIMIT 1`;
        if (brandData) {
            data.brand = brandData.name;
        }
    }

    const collectionIds = (formData.getAll("collectionIds") as string[]).filter(Boolean);
    const tagIds = (formData.getAll("tagIds") as string[]).filter(Boolean);

    try {
        // Fetch old stock for logging
        const [oldData] = await sql`SELECT stock_weight, name FROM products WHERE id = ${id} LIMIT 1`;
        const oldStock = oldData?.stock_weight || 0;

        await sql`
            UPDATE products SET
                name = ${data.name},
                brand_id = ${data.brand_id},
                brand = ${data.brand || null},
                description = ${data.description},
                category_id = ${data.category_id},
                image_url = ${data.image_url},
                base_price = ${data.base_price},
                purchase_price = ${data.purchase_price},
                stock_weight = ${data.stock_weight},
                low_stock_threshold = ${data.low_stock_threshold},
                status = ${data.status},
                collection_ids = ${collectionIds},
                tag_ids = ${tagIds},
                updated_at = NOW()
            WHERE id = ${id}
        `;

        // Log stock adjustment if changed
        if (data.stock_weight !== undefined && data.stock_weight !== oldStock) {
            await sql`
                INSERT INTO inventory_logs (product_id, change_type, quantity, source, reason)
                VALUES (${id}, 'ADJUSTMENT', ${data.stock_weight - oldStock}, 'ADMIN', ${`Manual adjustment from ${oldStock}g to ${data.stock_weight}g`})
            `;
        }

        await logEvent("PRODUCT_UPDATED", id, `Product "${data.name}" updated (Stock: ${oldStock}g -> ${data.stock_weight}g)`);
        revalidatePath("/admin/products");
        revalidatePath("/catalog");
        revalidatePath("/");
        (revalidateTag as any)("products");
        (revalidateTag as any)("featured-products");
        (revalidateTag as any)("new-arrivals");
        (revalidateTag as any)("best-sellers");
        return { success: true };
    } catch (error) {
        console.error("Update product error:", error);
        return { success: false, error: "Failed to update product" };
    }
}

export async function deleteProduct(id: string) {
    try {
        // Check for orders referencing this product
        const referencedItems = await sql`SELECT order_id FROM order_items WHERE product_id = ${id} LIMIT 1`;

        if (referencedItems && referencedItems.length > 0) {
            return { success: false, error: "Cannot delete product. It is referenced in existing orders." };
        }

        await sql`DELETE FROM products WHERE id = ${id}`;

        await logEvent("PRODUCT_DELETED", id, `Product ${id} deleted`);
        revalidatePath("/admin/products");
        revalidatePath("/catalog");
        revalidatePath("/");
        (revalidateTag as any)("products");
        (revalidateTag as any)("featured-products");
        (revalidateTag as any)("new-arrivals");
        (revalidateTag as any)("best-sellers");
        return { success: true };
    } catch (error) {
        console.error("Delete product error:", error);
        return { success: false, error: "Error during deletion" };
    }
}
