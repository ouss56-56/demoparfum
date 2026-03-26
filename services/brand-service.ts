import { sql } from "@/lib/db";

export interface Brand {
    id: string;
    name: string;
    slug: string;
    description?: string;
    logo_url?: string;
    website_url?: string;
    created_at: string;
}

export const getBrands = async () => {
    try {
        const brands = await sql`
            SELECT * FROM brands
            ORDER BY name ASC
        `;
        return brands as any as Brand[];
    } catch (error) {
        console.error("Brands fetch error (getBrands):", error);
        return [];
    }
};

export const createBrand = async (data: Partial<Brand>) => {
    const slug = data.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const [brand] = await sql`
        INSERT INTO brands (name, slug, description, image_url)
        VALUES (${data.name || null}, ${slug || null}, ${data.description || null}, ${data.logo_url || null})
        RETURNING *
    `;
    return brand as any as Brand;
};

export const updateBrand = async (id: string, data: Partial<Brand>) => {
    const [brand] = await sql`
        UPDATE brands 
        SET 
            name = ${data.name || null},
            description = ${data.description || null},
            image_url = ${data.logo_url || null}
        WHERE id = ${id}
        RETURNING *
    `;
    return brand as any as Brand;
};

export const deleteBrand = async (id: string) => {
    await sql`DELETE FROM brands WHERE id = ${id}`;
    return true;
};
