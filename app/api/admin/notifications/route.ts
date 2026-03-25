import { NextResponse } from "next/server";
import { getNotifications, getUnreadCount, markAllAsRead } from "@/services/notification-service";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        await requireAdminSession();
        const [notifications, unreadCount] = await Promise.all([
            getNotifications(),
            getUnreadCount(),
        ]);
        return NextResponse.json({ notifications, unreadCount });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT() {
    try {
        await requireAdminSession();
        await markAllAsRead();
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
