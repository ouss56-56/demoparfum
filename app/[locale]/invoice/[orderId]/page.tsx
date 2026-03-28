import { getInvoiceByOrderId } from "@/services/invoice-service";
import SafeImage from "@/components/SafeImage";
import { Printer, Download } from "lucide-react";
import { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
    title: "Order Invoice",
    robots: "noindex, nofollow"
};

export default async function InvoicePage({ 
    params 
}: { 
    params: Promise<{ locale: string; orderId: string }> 
}) {
    const { locale, orderId } = await params;
    const invoice = await getInvoiceByOrderId(orderId);
    if (!invoice) notFound();
    const order = invoice.order as any;

    const isRtl = locale === 'ar';

    return (
        <div className="min-h-screen bg-white p-4 sm:p-8 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
            {/* Header Controls (Hidden on Print) */}
            <div className="max-w-4xl mx-auto mb-8 flex justify-between items-center print:hidden border-b border-gray-100 pb-6">
                <div>
                    <h1 className="text-2xl font-serif font-bold text-primary-dark">Invoice Preview</h1>
                    <p className="text-gray-500 text-sm">Review or print your order invoice</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => window.print()} 
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium"
                    >
                        <Printer className="w-4 h-4" />
                        Print / Save as PDF
                    </button>
                </div>
            </div>

            {/* Invoice Layout */}
            <div className="max-w-4xl mx-auto shadow-sm border border-gray-100 rounded-2xl p-8 sm:p-12 print:shadow-none print:border-none print:m-0 print:p-0">
                <div className="flex justify-between items-start mb-12">
                    <div>
                        <div className="mb-4">
                             <div className="text-3xl font-serif font-bold tracking-tight text-primary-dark uppercase">
                                DEMO PARFUM
                            </div>
                            <div className="text-[10px] font-black tracking-[0.3em] text-primary mt-1">
                                EXCELLENCE EN PARFUMERIE
                            </div>
                        </div>
                        <div className="text-sm text-gray-500 space-y-1">
                            <p>Algeria, Algiers</p>
                            <p>Contact: +213 555 123 456</p>
                            <p>Email: contact@demoparfum.dz</p>
                        </div>
                    </div>
                    <div className="text-right rtl:text-left">
                        <h2 className="text-4xl font-serif font-bold text-gray-900 mb-2">INVOICE</h2>
                        <div className="text-sm font-bold text-primary uppercase tracking-widest">{invoice.invoiceNumber}</div>
                        <div className="text-xs text-gray-400 mt-1">Date: {new Date(invoice.issueDate || "").toLocaleDateString(locale)}</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-12 mb-12">
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-50 pb-2">Bill To</h3>
                        <div className="space-y-1">
                            <p className="font-bold text-gray-900 text-lg">{order.customer?.shopName || order.customer?.name}</p>
                            <p className="text-sm text-gray-600">{order.customer?.phone}</p>
                            <p className="text-sm text-gray-600 leading-relaxed">
                                {order.customer?.address}<br />
                                {order.wilayaName ? `${order.wilayaNumber} - ${order.wilayaName}` : order.customer?.wilaya}
                            </p>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 border-b border-gray-50 pb-2">Order Information</h3>
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Order ID:</span>
                                <span className="font-bold">#{order.id.slice(-6).toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Payment Status:</span>
                                <span className="font-bold">{order.paymentStatus}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Status:</span>
                                <span className="font-bold">{order.status}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <table className="w-full mb-12">
                    <thead>
                        <tr className="border-b-2 border-gray-900">
                            <th className="py-4 text-left rtl:text-right text-xs font-black uppercase tracking-widest text-gray-900">Description</th>
                            <th className="py-4 text-center text-xs font-black uppercase tracking-widest text-gray-900">Qty</th>
                            <th className="py-4 text-right rtl:text-left text-xs font-black uppercase tracking-widest text-gray-900">Unit Price</th>
                            <th className="py-4 text-right rtl:text-left text-xs font-black uppercase tracking-widest text-gray-900">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {order.items?.map((item: any) => (
                            <tr key={item.id}>
                                <td className="py-5">
                                    <p className="font-bold text-gray-900">{item.product?.name}</p>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                        {item.product?.brand} • {item.volume?.label || item.volume || '100ml'}
                                    </p>
                                </td>
                                <td className="py-5 text-center text-sm font-medium">{item.quantity}</td>
                                <td className="py-5 text-right rtl:text-left text-sm font-medium">{Number(item.price).toLocaleString()} DA</td>
                                <td className="py-5 text-right rtl:text-left text-sm font-bold text-gray-900">{(Number(item.price) * item.quantity).toLocaleString()} DA</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="flex justify-end">
                    <div className="w-64 space-y-3">
                        <div className="flex justify-between text-sm text-gray-500">
                            <span>Subtotal</span>
                            <span>{Number(order.totalPrice).toLocaleString()} DA</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-500">
                            <span>Shipping</span>
                            <span>0 DA</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-gray-900">
                            <span className="text-base font-serif font-bold text-gray-900">Total Amount</span>
                            <span className="text-base font-serif font-bold text-primary">{Number(order.totalPrice).toLocaleString()} DA</span>
                        </div>
                    </div>
                </div>

                <div className="mt-24 pt-8 border-t border-gray-50 text-center text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
                    THANK YOU FOR SHOPPING WITH DEMO PARFUM
                </div>
            </div>

            {/* Script to handle printing automatically if used as a secondary route */}
            <script dangerouslySetInnerHTML={{ __html: `
                // Optional: Auto-print if query param present
                if (window.location.search.includes('print=true')) {
                    setTimeout(() => window.print(), 500);
                }
            `}} />
        </div>
    );
}
