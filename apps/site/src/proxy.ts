import { NextResponse, type NextRequest } from "next/server";

const API_ORIGIN = process.env.PUBLIC_API_ORIGIN ?? "http://localhost:3002";

function createNonce(): string {
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString("base64");
}

export function proxy(request: NextRequest): NextResponse {
    const nonce = createNonce();
    const production = process.env.NODE_ENV === "production";
    const csp = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        `connect-src 'self' ${new URL(API_ORIGIN).origin}`,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        ...(production ? ["upgrade-insecure-requests"] : []),
    ].join("; ");

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("content-security-policy", csp);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("content-security-policy", csp);
    // CSP nonces differ per request, so HTML must never be served from a shared cache.
    response.headers.set("cache-control", "private, no-store");
    response.headers.set("x-content-type-options", "nosniff");
    response.headers.set("x-frame-options", "DENY");
    response.headers.set("referrer-policy", "no-referrer");
    return response;
}

export const config = {
    matcher: "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
};
