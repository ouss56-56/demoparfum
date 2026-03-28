import { getInvoiceByOrderId } from "@/services/invoice-service";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import InvoiceView from "@/components/shop/InvoiceView";
import PrintInvoiceButton from "@/components/shop/PrintInvoiceButton";

export const dynamic = "force-dynamic";

export default async function CustomerInvoicePage({ params }: { params: Promise<{ id: string, locale: string }> }) {
    const { id, locale } = await params;
    const invoiceData = await getInvoiceByOrderId(id);
    if (!invoiceData) notFound();
    const order = invoiceData.order as any;

    const invoice = {
        invoiceNumber: invoiceData.invoiceNumber,
        issueDate: invoiceData.issueDate || new Date(),
        totalAmount: invoiceData.totalAmount,
        orderId: id,
        amountPaid: invoiceData.amountPaid,
        paymentStatus: invoiceData.paymentStatus,
        order: order
    };

    return (
        <div className="min-h-screen bg-gray-50 print:bg-white p-4 sm:p-12">
            {/* Action Bar */}
            <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between border-b border-gray-100 pb-4 print:hidden">
                <Link href={`/${locale}/account/orders/${id}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors font-bold">
                    <ArrowLeft className="w-4 h-4" /> Back to Order
                </Link>
                <PrintInvoiceButton />
            </div>

            <InvoiceView invoice={invoice} locale={locale} />
        </div>
    );
}
