"use server";

import { sql } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createCategorySchema, formatZodErrors } from "@/lib/validation";
import { logEvent } from "@/lib/logger";

export async function createCategory(formData: FormData) {
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || "";

    const parsed = createCategorySchema.safeParse({ name, description });
    if (!parsed.success) {
        return { success: false, error: formatZodErrors(parsed.error) };
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    try {
        // Check if category with same name or slug already exists
        const [existing] = await sql`
            SELECT id FROM categories WHERE name = ${name} OR slug = ${slug} LIMIT 1
        `;

        if (existing) {
            return { success: false, error: `Category "${name}" already exists.` };
        }

        const [category] = await sql`
            INSERT INTO categories (name, slug, description)
            VALUES (${name}, ${slug}, ${description})
            RETURNING *
        `;

        await logEvent("CATEGORY_CREATED", category.id, `Category "${name}" created`);
        revalidatePath("/admin/categories");
        revalidatePath("/admin/products");
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        console.error("Create category error:", error);
        return { success: false, error: error.message || "Failed to create category" };
    }
}

export async function updateCategory(id: string, formData: FormData) {
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || "";

    const parsed = createCategorySchema.safeParse({ name, description });
    if (!parsed.success) {
        return { success: false, error: formatZodErrors(parsed.error) };
    }

    try {
        await sql`
            UPDATE categories SET
                name = ${name},
                description = ${description},
                updated_at = NOW()
            WHERE id = ${id}
        `;

        revalidatePath("/admin/categories");
        revalidatePath("/admin/products");
        revalidatePath("/", "layout");
        try {
            const { revalidateTag } = await import("next/cache");
            (revalidateTag as any)("products");
        } catch (e) {
            console.error("Revalidate tag failed", e);
        }
        return { success: true };
    } catch (error) {
        console.error("Update category error:", error);
        return { success: false, error: "Failed to update category" };
    }
}

export async function deleteCategory(id: string) {
    try {
        // Nullify category references in products before deleting
        await sql`UPDATE products SET category_id = NULL WHERE category_id = ${id}`;
        await sql`DELETE FROM categories WHERE id = ${id}`;

        await logEvent("CATEGORY_DELETED", id, `Category ${id} deleted`);
        revalidatePath("/admin/categories");
        revalidatePath("/admin/products");
        revalidatePath("/", "layout");
        try {
            const { revalidateTag } = await import("next/cache");
            (revalidateTag as any)("products");
        } catch (e) {
            console.error("Revalidate tag failed", e);
        }
        return { success: true };
    } catch (error) {
        console.error("Delete category error:", error);
        return { success: false, error: "Error during deletion" };
    }
}
