"use client";

import { useState, useEffect, useRef } from "react";
import { Megaphone, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useLocale } from 'next-intl';
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function AnnouncementMarquee() {
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [isVisible, setIsVisible] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);
    const locale = useLocale();
    const isRtl = locale === 'ar';

    useEffect(() => {
        const fetchAnnouncements = async () => {
            try {
                const { data, error } = await supabase
                    .from("notifications")
                    .select("*")
                    .eq("type", "ANNOUNCEMENT")
                    .order("created_at", { ascending: false })
                    .limit(5);

                if (error) {
                    console.error("[Marquee] Fetch error:", error);
                    return;
                }

                console.log("[Marquee] Fetched announcements:", data?.length);
                if (data && data.length > 0) {
                    setAnnouncements(data);
                }
            } catch (err) {
                console.error("[Marquee] Unexpected error:", err);
            }
        };

        fetchAnnouncements();
        
        // Update CSS variable for height
        const updateHeight = () => {
            if (containerRef.current) {
                const height = containerRef.current.offsetHeight;
                document.documentElement.style.setProperty('--announcement-height', `${height}px`);
                console.log("[Marquee] Height set to:", height);
            } else {
                document.documentElement.style.setProperty('--announcement-height', '0px');
            }
        };

        updateHeight();
        window.addEventListener('resize', updateHeight);

        const channel = supabase
            .channel('public:notifications_marquee')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'notifications', 
                filter: "type=eq.ANNOUNCEMENT" 
            }, () => {
                fetchAnnouncements();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('resize', updateHeight);
            document.documentElement.style.setProperty('--announcement-height', '0px');
        };
    }, []);

    useEffect(() => {
        // Recalculate if visibility or announcement count changes
        if (containerRef.current && isVisible && announcements.length > 0) {
            const height = containerRef.current.offsetHeight;
            document.documentElement.style.setProperty('--announcement-height', `${height}px`);
        } else {
            document.documentElement.style.setProperty('--announcement-height', '0px');
        }
    }, [isVisible, announcements]);

    if (!isVisible || announcements.length === 0) return null;

    return (
        <div 
            ref={containerRef}
            className="bg-[#1a1a1a] text-white/90 py-1.5 relative border-b border-white/5 overflow-hidden z-[60]"
        >
            <div className="max-w-7xl mx-auto px-6 relative flex items-center gap-8">
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                    <Megaphone className="w-2.5 h-2.5 text-[#D4AF37]" />
                    <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-[#D4AF37]">
                        {isRtl ? 'إعلان' : 'News'}
                    </span>
                </div>
                
                <div className="overflow-hidden flex-1 relative h-6 flex items-center">
                    <div className="whitespace-nowrap flex animate-marquee hover:pause-marquee">
                        {announcements.map((ann, i) => (
                            <div key={`${ann.id}-${i}`} className="mx-8 flex items-center gap-4">
                                <span className="text-[#D4AF37] opacity-40 text-[9px]">✦</span>
                                <span className="text-[11px] sm:text-[12px] font-light tracking-wide flex items-center gap-3">
                                    <span className="text-white font-medium">{ann.title}</span>
                                    <span className="text-white/60">{ann.message}</span>
                                </span>
                                {ann.link && (
                                    <Link 
                                        href={ann.link.startsWith('http') ? ann.link : `/${locale}${ann.link.startsWith('/') ? '' : '/'}${ann.link}`} 
                                        className="text-[#D4AF37] hover:text-white text-[9px] font-bold uppercase tracking-widest transition-colors"
                                        target={ann.link.startsWith('http') ? "_blank" : undefined}
                                        rel={ann.link.startsWith('http') ? "noopener noreferrer" : undefined}
                                    >
                                        {isRtl ? 'التفاصيل' : 'Details'}
                                    </Link>
                                )}
                            </div>
                        ))}
                        {/* Duplicate for seamless loop if needed, but 40s is usually enough for 5 items */}
                    </div>
                </div>

                <button 
                    onClick={() => setIsVisible(false)}
                    className="shrink-0 p-1 hover:text-[#D4AF37] transition-colors"
                >
                    <X className="w-3.5 h-3.5 opacity-30" />
                </button>
            </div>

            <style jsx>{`
                @keyframes marquee {
                    0% { transform: translateX(10%); }
                    100% { transform: translateX(-100%); }
                }
                .animate-marquee {
                    animation: marquee 85s linear infinite;
                }
                .pause-marquee:hover {
                    animation-play-state: paused;
                }
            `}</style>
        </div>
    );
}
