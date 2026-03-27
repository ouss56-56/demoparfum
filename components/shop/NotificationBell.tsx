"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X, Megaphone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLocale } from 'next-intl';

export default function NotificationBell({ isHeroPage, userId }: { isHeroPage?: boolean, userId?: string }) {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [hasUnread, setHasUnread] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const locale = useLocale();
    const isRtl = locale === 'ar';

    useEffect(() => {
        const fetchNotifications = async () => {
            let query = supabase
                .from("notifications")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(10);
            
            if (userId) {
                // Fetch announcements OR notifications for this user
                query = query.or(`type.eq.ANNOUNCEMENT,user_id.eq.${userId}`);
            } else {
                query = query.eq("type", "ANNOUNCEMENT");
            }

            const { data } = await query;

            if (data) {
                setNotifications(data);
                const seenIds = JSON.parse(localStorage.getItem('seenNotifications') || '[]');
                const newUnread = data.some(a => !seenIds.includes(a.id));
                setHasUnread(newUnread);
            }
        };

        fetchNotifications();

        // Subscribe to relevant notifications
        const channel = supabase
            .channel('notifications-realtime')
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'notifications'
            }, payload => {
                const newNotif = payload.new;
                if (newNotif.type === "ANNOUNCEMENT" || (userId && newNotif.user_id === userId)) {
                    fetchNotifications();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOpen = () => {
        if (!isOpen && hasUnread) {
            // Mark as read in local storage
            const ids = notifications.map(n => n.id);
            localStorage.setItem('seenNotifications', JSON.stringify(ids));
            setHasUnread(false);
        }
        setIsOpen(!isOpen);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={toggleOpen}
                className={`relative p-2 rounded-full transition-all duration-300 ${isHeroPage
                        ? "text-white/70 hover:text-[#D4AF37] hover:bg-white/5"
                        : "text-gray-500 hover:text-primary hover:bg-primary/5"
                    }`}
            >
                <Bell className="w-5 h-5" />
                {hasUnread && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-white" />
                )}
            </button>

            {isOpen && (
                <div className={`absolute top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 z-50 ${isRtl ? 'left-0' : 'right-0'}`}>
                    <div className={`flex items-center justify-between mb-4 pb-2 border-b border-gray-50 ${isRtl ? 'flex-row-reverse' : ''}`}>
                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                            <Megaphone className="w-4 h-4 text-[#D4AF37]" />
                            {isRtl ? 'الإعلانات' : 'Announcements'}
                        </h3>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center">
                                <Megaphone className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                                <p className="text-sm text-gray-400 font-medium">{isRtl ? 'لا توجد إشعارات حالياً' : 'No notifications yet'}</p>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div key={n.id} className={`p-3 rounded-xl hover:bg-gray-100 transition-colors ${n.type === 'ORDER_STATUS' ? 'bg-primary/5 border border-primary/10' : 'bg-gray-50'} ${isRtl ? 'text-right' : 'text-left'}`}>
                                    <h4 className="font-bold text-sm text-primary-dark mb-1 flex items-center justify-between">
                                        {n.title}
                                        {n.type === 'ORDER_STATUS' && <span className="w-2 h-2 bg-primary rounded-full" />}
                                    </h4>
                                    <p className="text-xs text-gray-600 leading-relaxed">{n.message}</p>
                                    <div className={`flex items-center justify-between mt-2 ${isRtl ? 'flex-row-reverse' : ''}`}>
                                        <span className="text-[10px] text-gray-400">
                                            {new Intl.DateTimeFormat(isRtl ? 'ar-DZ' : 'fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(n.created_at))}
                                        </span>
                                        {n.metadata?.orderId && (
                                            <a href={`/${locale}/account/orders/${n.metadata.orderId}`} className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
                                                {isRtl ? 'عرض الطلب' : 'View Order'}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
