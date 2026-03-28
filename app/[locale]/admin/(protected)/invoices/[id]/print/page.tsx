import { getInvoiceByOrderId } from "@/services/invoice-service";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import InvoiceView from "@/components/shop/InvoiceView";
import PrintButton from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string, locale: string }> }) {
    const { id, locale } = await params;
    
    const invoiceData = await getInvoiceByOrderId(id);
    if (!invoiceData) return <div className="p-8">Invoice not found.</div>;
    const orderData = invoiceData.order as any;

    const invoice = {
        invoiceNumber: invoiceData.invoiceNumber,
        issueDate: invoiceData.issueDate || new Date(),
        totalAmount: invoiceData.totalAmount,
        orderId: id,
        order: orderData
    };

    return (
        <div className="min-h-screen bg-gray-50 print:bg-white p-4 sm:p-12">
            {/* Screen Header (Hidden on Print) */}
            <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between border-b border-gray-100 pb-4 print:hidden">
                <Link href={`/${locale}/admin/orders/${invoice.orderId}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors font-bold">
                    <ArrowLeft className="w-4 h-4" /> Back to Order
                </Link>
                <div className="flex gap-3">
                    <PrintButton label="Print Document" />
                </div>
            </div>

            {/* Print Content */}
            <InvoiceView invoice={invoice} locale={locale} />
        </div>
    );
}
