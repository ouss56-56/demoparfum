import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        await requireAdminSession();
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");

        if (!type) {
            return new NextResponse("Missing report type", { status: 400 });
        }

        let csvData = "";
        let filename = "report.csv";

        if (type === "inventory") {
            const products = await sql`SELECT * FROM products ORDER BY name ASC`;

            csvData = "ID,Name,Brand,Category,BasePrice,Stock,Commune,LowStockThreshold\n";
            (products || []).forEach((p: any) => {
                csvData += `${p.id},"${p.name}","${p.brand}","${p.category_id || ''}",${p.base_price},${p.stock_weight || 0},"${p.commune || ''}",${p.low_stock_threshold || 500}\n`;
            });
            filename = `inventory_report_${new Date().toISOString().split('T')[0]}.csv`;
        }

        else if (type === "sales") {
            const orders = await sql`
                SELECT o.*, 
                    (SELECT c.shop_name FROM customers c WHERE c.id = o.customer_id) as shop_name,
                    (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) as total_items
                FROM orders o
                WHERE o.status != 'CANCELLED'
                ORDER BY o.created_at DESC
            `;

            csvData = "OrderID,Date,Customer,Commune,TotalItems,TotalRevenue,Status\n";
            (orders || []).forEach((o: any) => {
                const createdAt = new Date(o.created_at);
                csvData += `${o.id},${createdAt.toISOString().split('T')[0]},"${o.shop_name || ''}","${o.commune || ''}",${o.total_items || 0},${o.total_price},${o.status}\n`;
            });
            filename = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;
        }
        else if (type === "customers") {
            const customers = await sql`SELECT * FROM customers ORDER BY name ASC`;
            const orders = await sql`SELECT customer_id, total_price FROM orders WHERE status != 'CANCELLED'`;

            const customerOrdersMap = new Map<string, { count: number; totalSpent: number }>();
            (orders || []).forEach((o: any) => {
                if (o.customer_id) {
                    const curr = customerOrdersMap.get(o.customer_id) || { count: 0, totalSpent: 0 };
                    curr.count++;
                    curr.totalSpent += Number(o.total_price || 0);
                    customerOrdersMap.set(o.customer_id, curr);
                }
            });

            csvData = "CustomerID,ShopName,ContactName,Phone,Wilaya,Commune,TotalOrders,TotalSpent\n";
            (customers || []).forEach((c: any) => {
                const stats = customerOrdersMap.get(c.id) || { count: 0, totalSpent: 0 };
                csvData += `${c.id},"${c.shop_name}","${c.name}","${c.phone}","${c.wilaya}","${c.commune}",${stats.count},${stats.totalSpent}\n`;
            });
            filename = `customers_report_${new Date().toISOString().split('T')[0]}.csv`;
        } else {
            return new NextResponse("Invalid report type", { status: 400 });
        }

        const bom = "\ufeff";
        return new NextResponse(bom + csvData, {
            status: 200,
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}"`
            }
        });

    } catch (error: any) {
        console.error("Export Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
