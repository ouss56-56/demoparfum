import { sql } from "@/lib/db";
import { revalidateTag } from "next/cache";

function generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── READ ──────────────────────────────────────────────────────────────────
export const getTags = async () => {
    const tags = await sql`SELECT * FROM tags ORDER BY name ASC`;

    return (tags || []).map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        createdAt: new Date(tag.created_at),
        products: []
    }));
};

// ── CREATE ────────────────────────────────────────────────────────────────
export const createTag = async (data: { name: string }) => {
    const slug = generateSlug(data.name);
    const [newTag] = await sql`
        INSERT INTO tags (name, slug)
        VALUES (${data.name}, ${slug})
        RETURNING *
    `;

    (revalidateTag as any)('tags');
    return { id: newTag.id, name: newTag.name, slug: newTag.slug };
};

// ── UPDATE ────────────────────────────────────────────────────────────────
export const updateTag = async (id: string, data: { name: string }) => {
    const slug = generateSlug(data.name);
    const [updatedTag] = await sql`
        UPDATE tags SET name = ${data.name}, slug = ${slug}
        WHERE id = ${id}
        RETURNING *
    `;

    (revalidateTag as any)('tags');
    return { id: updatedTag.id, name: updatedTag.name, slug: updatedTag.slug };
};

// ── DELETE ────────────────────────────────────────────────────────────────
export const deleteTag = async (id: string) => {
    await sql`DELETE FROM tags WHERE id = ${id}`;
    (revalidateTag as any)('tags');
    return { id };
};
