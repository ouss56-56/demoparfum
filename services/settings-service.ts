import { sql } from "@/lib/db";

export interface SiteSettings {
    id: string;
    whatsapp_number: string;
    facebook_page: string;
    contact_email: string | null;
    store_address: string | null;
    logo_url: string | null;
    updated_at: string;
}

export async function getSiteSettings(): Promise<SiteSettings> {
    try {
        const [data] = await sql`SELECT * FROM site_settings LIMIT 1`;

        if (!data) {
            return {
                id: "00000000-0000-0000-0000-000000000000",
                whatsapp_number: "+213555000000",
                facebook_page: "demo_perfume",
                contact_email: "contact@demo-perfume.com",
                store_address: "Algeria, Setif",
                logo_url: null,
                updated_at: new Date().toISOString()
            };
        }

        return data as SiteSettings;
    } catch (e) {
        console.error("getSiteSettings crash:", e);
        return {
            id: "",
            whatsapp_number: "+213555000000",
            facebook_page: "demo_perfume",
            contact_email: "contact@demo-perfume.com",
            store_address: "Algeria, Setif",
            logo_url: null,
            updated_at: new Date().toISOString()
        };
    }
}

export async function updateSiteSettings(settings: Partial<SiteSettings>) {
    try {
        const updateObj: any = { ...settings };
        updateObj.updated_at = new Date().toISOString();
        delete updateObj.id;

        await sql`
            UPDATE site_settings SET ${sql(updateObj)}
            WHERE id = (SELECT id FROM site_settings LIMIT 1)
        `;

        return { success: true };
    } catch (error: any) {
        console.error("updateSiteSettings error:", error);
        return { success: false, error: error.message };
    }
}
