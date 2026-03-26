"use server";

import { sql } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { createCategorySchema, formatZodErrors } from "@/lib/validation";
import { logEvent } from "@/lib/logger";

export async function createBrand(formData: FormData) {
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || "";

    const parsed = createCategorySchema.safeParse({ name, description });
    if (!parsed.success) {
        return { success: false, error: formatZodErrors(parsed.error) };
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    try {
        // Check if brand with same name or slug already exists
        const [existing] = await sql`
            SELECT id FROM brands WHERE name = ${name} OR slug = ${slug} LIMIT 1
        `;

        if (existing) {
            return { success: false, error: `Brand "${name}" already exists.` };
        }

        const [brand] = await sql`
            INSERT INTO brands (name, slug, description)
            VALUES (${name}, ${slug}, ${description})
            RETURNING *
        `;

        await logEvent("BRAND_CREATED", brand.id, `Brand "${name}" created`);
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error: any) {
        console.error("Create brand error:", error);
        return { success: false, error: error.message || "Failed to create brand" };
    }
}

export async function updateBrand(id: string, formData: FormData) {
    const name = formData.get("name") as string;
    const description = (formData.get("description") as string) || "";

    const parsed = createCategorySchema.safeParse({ name, description });
    if (!parsed.success) {
        return { success: false, error: formatZodErrors(parsed.error) };
    }

    try {
        await sql`
            UPDATE brands SET name = ${name}, description = ${description}
            WHERE id = ${id}
        `;

        revalidatePath("/", "layout");
        return { success: true };
    } catch (error) {
        console.error("Update brand error:", error);
        return { success: false, error: "Failed to update brand" };
    }
}

export async function deleteBrand(id: string) {
    try {
        // Nullify brand references in products before deleting
        await sql`UPDATE products SET brand_id = NULL, brand = NULL WHERE brand_id = ${id}`;
        await sql`DELETE FROM brands WHERE id = ${id}`;

        await logEvent("BRAND_DELETED", id, `Brand ${id} deleted`);
        revalidatePath("/", "layout");
        return { success: true };
    } catch (error) {
        console.error("Delete brand error:", error);
        return { success: false, error: "Error during deletion" };
    }
}
