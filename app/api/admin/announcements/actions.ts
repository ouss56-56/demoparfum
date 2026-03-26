'use server';

import { sql } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createAnnouncement(data: { title: string, message: string, link?: string }) {
    try {
        await sql`
            INSERT INTO notifications (type, title, message, link, is_read)
            VALUES ('ANNOUNCEMENT', ${data.title}, ${data.message}, ${data.link || null}, false)
        `;
        
        revalidatePath('/', 'layout');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteAnnouncement(id: string) {
    try {
        await sql`DELETE FROM notifications WHERE id = ${id}::UUID AND type = 'ANNOUNCEMENT'`;
        
        revalidatePath('/[locale]/admin/(protected)/announcements', 'page');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
