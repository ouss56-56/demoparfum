import { getInvoiceByOrderId } from "@/services/invoice-service";
import { notFound } from "next/navigation";
import InvoiceView from "@/components/shop/InvoiceView";
import { ArrowLeft, Printer, Download, Share2 } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function AdminInvoiceDetailPage({ 
    params 
}: { 
    params: Promise<{ id: string, locale: string }> 
}) {
    const { id, locale } = await params;
    const t = await getTranslations({ locale, namespace: "admin.invoices" });
    
    const invoiceData = await getInvoiceByOrderId(id);

    if (!invoiceData) {
        notFound();
    }

    const invoice = {
        invoiceNumber: invoiceData.invoiceNumber,
        issueDate: invoiceData.issueDate || new Date(),
        totalAmount: invoiceData.totalAmount,
        orderId: invoiceData.orderId,
        amountPaid: invoiceData.amountPaid,
        paymentStatus: invoiceData.paymentStatus,
        order: invoiceData.order
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-primary/5 sticky top-0 z-20 print:hidden">
                <div className="flex items-center gap-4">
                    <Link 
                        href={`/${locale}/admin/invoices`}
                        className="w-10 h-10 rounded-full border border-gray-100 flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary/20 transition-all"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-serif font-bold text-primary-dark">
                            {t("details_title") || "Invoice Details"}
                        </h1>
                        <p className="text-xs text-gray-500 font-medium">
                            {invoice.invoiceNumber} • Associated with Order #{invoice.orderId.slice(0, 8).toUpperCase()}
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <Link
                        href={`/${locale}/admin/invoices/${id}/print`}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary-dark text-white rounded-full text-sm font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-all"
                    >
                        <Printer className="w-4 h-4" />
                        {t("print") || "Print Invoice"}
                    </Link>
                </div>
            </div>

            {/* Invoice Content */}
            <div className="bg-transparent print:bg-white">
                <InvoiceView invoice={invoice as any} locale={locale} />
            </div>

            {/* Footer Notice (Screen only) */}
            <div className="max-w-4xl mx-auto p-6 bg-blue-50/50 rounded-2xl border border-blue-100/50 text-center print:hidden">
                <p className="text-sm text-blue-600 font-medium">
                    This is an administrative view of the invoice. Changes made to the order will reflect here automatically.
                </p>
            </div>
        </div>
    );
}
