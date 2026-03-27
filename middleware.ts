// No changes needed to the core verifyJwtToken logic in middleware as it's purely cryptographic,
// but ensured that all flows are compatible with the new Supabase-backed services.
// The middleware already uses JWT verification which is backend-agnostic once signed.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyJwtToken } from "./lib/auth";
import { isRateLimited } from "./lib/rate-limit";
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export const config = {
    matcher: ["/((?!api|_next|.*\\..*).*)", "/admin/:path*", "/account/:path*", "/api/:path*"],
};

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Prepare request headers for Server Components
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-pathname', pathname);

    // 2. Define a helper to run intl middleware while preserving our headers
    const handleIntl = (req: NextRequest) => {
        const response = intlMiddleware(req);
        
        // If it's a redirect, return as is
        if (response.status >= 300 && response.status < 400) {
            return response;
        }

        // For non-redirects, we want to ensure the REQUEST headers reach the Server Components.
        // We create a new 'next' response that explicitly carries our modified request headers.
        const finalResponse = NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });

        // Copy over the headers (including cookies) from the intl middleware response
        response.headers.forEach((value, key) => {
            finalResponse.headers.set(key, value);
        });

        return finalResponse;
    };

    // ── RATE LIMITING ───────────────────────────────────────────────────────
    if (pathname.startsWith("/api/")) {
        const rateLimitedPaths = ["/api/orders", "/api/cart", "/api/customers/login", "/api/customers/register"];
        const shouldLimit = rateLimitedPaths.some((p) => pathname.startsWith(p));

        if (shouldLimit) {
            const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
                       "unknown";
            if (isRateLimited(ip)) {
                return NextResponse.json(
                    { success: false, error_code: "RATE_LIMITED", message: "Too many requests." },
                    { status: 429 }
                );
            }
        }

        // ── API PROTECTION (CRITICAL) ──────────────────────────────────────────
        // Only verify JWT for non-public API routes
        const isAdminApi = pathname.startsWith("/api/admin") && !pathname.includes("/admin/login");
        const isProtectedCustomerApi = pathname.startsWith("/api/customers/me") || pathname.startsWith("/api/account");

        if (isAdminApi) {
            const token = request.cookies.get("admin_token")?.value;
            if (!token) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
            const payload = await verifyJwtToken(token);
            if (!payload || !["ADMIN", "SUPER_ADMIN", "VENDOR"].includes(payload.role as string)) {
                return NextResponse.json({ error: "Forbidden", code: "ACCESS_DENIED" }, { status: 403 });
            }
        }

        if (isProtectedCustomerApi) {
            const token = request.cookies.get("customer_token")?.value;
            if (!token) return NextResponse.json({ error: "Unauthorized", code: "AUTH_REQUIRED" }, { status: 401 });
            const payload = await verifyJwtToken(token);
            if (!payload || payload.role !== "TRADER") {
                return NextResponse.json({ error: "Forbidden", code: "ACCESS_DENIED" }, { status: 403 });
            }
        }

        return NextResponse.next();
    }

    // ── ADMIN PROTECTION ──────────────────────────────────────────────────
    if (pathname.includes("/admin")) {
        const locale = pathname.split('/')[1] || routing.defaultLocale;
        const lang = routing.locales.includes(locale as any) ? locale : routing.defaultLocale;
        
        const adminLoginPath = `/${lang}/admin/login`;
        const adminDashboardPath = `/${lang}/admin/dashboard`;

        if (pathname.includes("/admin/login")) {
            const token = request.cookies.get("admin_token")?.value;
            if (token) {
                const payload = await verifyJwtToken(token);
                if (payload && ["ADMIN", "SUPER_ADMIN", "VENDOR"].includes(payload.role as string)) {
                    return NextResponse.redirect(new URL(adminDashboardPath, request.url));
                }
            }
            return handleIntl(request);
        }

        const token = request.cookies.get("admin_token")?.value;
        if (!token) return NextResponse.redirect(new URL(adminLoginPath, request.url));

        try {
            const payload = await verifyJwtToken(token);
            if (!payload || !["ADMIN", "SUPER_ADMIN", "VENDOR"].includes(payload.role as string)) {
                return NextResponse.redirect(new URL(adminLoginPath, request.url));
            }
            return handleIntl(request);
        } catch {
            return NextResponse.redirect(new URL(adminLoginPath, request.url));
        }
    }

    // ── CUSTOMER PROTECTION ───────────────────────────────────────────────
    if (pathname.includes("/account")) {
        const locale = pathname.split('/')[1] || routing.defaultLocale;
        const lang = routing.locales.includes(locale as any) ? locale : routing.defaultLocale;
        const loginPath = `/${lang}/login`;

        const token = request.cookies.get("customer_token")?.value;
        if (!token) return NextResponse.redirect(new URL(loginPath, request.url));

        try {
            const payload = await verifyJwtToken(token);
            if (!payload || payload.role !== "TRADER") {
                return NextResponse.redirect(new URL(loginPath, request.url));
            }
            return handleIntl(request);
        } catch {
            return NextResponse.redirect(new URL(loginPath, request.url));
        }
    }

    return handleIntl(request);
}
