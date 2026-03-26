import { getTranslations } from "next-intl/server";
import { Shield, Globe, Palette, Store, Phone, Mail, MapPin, Link2, Image, Lock, Eye, EyeOff, Key } from "lucide-react";
import AdminPasswordForm from "@/components/admin/AdminPasswordForm";
import AdminSiteSettingsForm from "@/components/admin/AdminSiteSettingsForm";
import { getSiteSettings } from "@/services/settings-service";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale });
    const settings = await getSiteSettings();

    return (
        <div className="space-y-10 animate-in fade-in duration-500 max-w-5xl mx-auto pb-20">
            {/* Page Header */}
            <div className="relative">
                <div className="absolute -top-4 -left-4 w-24 h-24 bg-gradient-to-br from-[#D4AF37]/20 to-transparent rounded-full blur-2xl" />
                <div className="relative">
                    <h1 className="text-3xl font-serif font-bold text-primary-dark tracking-tight">{t("admin.settings.title")}</h1>
                    <p className="text-gray-500 mt-2 font-medium">{t("admin.settings.subtitle")}</p>
                </div>
            </div>

            {/* Site Configuration */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-lg shadow-gray-100/50 overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-gradient-to-r from-gray-50/80 to-white">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary shadow-sm">
                            <Globe className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 tracking-tight">{t("admin.settings.site.title")}</h2>
                            <p className="text-sm text-gray-500 font-medium mt-0.5">{t("admin.settings.site.description")}</p>
                        </div>
                    </div>
                </div>
                <div className="p-8 bg-gradient-to-b from-white to-gray-50/30">
                    <AdminSiteSettingsForm settings={settings} />
                </div>
            </div>

            {/* Security Settings */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-lg shadow-gray-100/50 overflow-hidden">
                <div className="p-6 border-b border-gray-50 bg-gradient-to-r from-amber-50/50 to-white">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 flex items-center justify-center text-[#D4AF37] shadow-sm">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 tracking-tight">{t("admin.settings.security.title")}</h2>
                            <p className="text-sm text-gray-500 font-medium mt-0.5">{t("admin.settings.security.description")}</p>
                        </div>
                    </div>
                </div>
                <div className="p-8 bg-gradient-to-b from-white to-gray-50/30">
                    <AdminPasswordForm />
                </div>
            </div>

            {/* System Info */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-8 text-white shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                        <Palette className="w-5 h-5 text-[#D4AF37]" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg">Platform Information</h3>
                        <p className="text-gray-400 text-sm font-medium">Demo Perfume Platform v2.0</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Framework</p>
                        <p className="text-sm font-bold text-white">Next.js 16</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Database</p>
                        <p className="text-sm font-bold text-white">PostgreSQL</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Storage</p>
                        <p className="text-sm font-bold text-white">Supabase</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Deploy</p>
                        <p className="text-sm font-bold text-white">Vercel</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
