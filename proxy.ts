import { NextResponse, type NextRequest } from "next/server";

// Auth-gated app areas. The server components under app/(dashboard) enforce
// this too; the redirect here just avoids rendering a shell the user cannot use.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/overview",
  "/inbox",
  "/campaigns",
  "/automations",
  "/logs",
  "/settings",
  "/diagnostics",
];

// Public acquisition surface inherited from OpenReply. Hidden when
// APP_PRIVATE_INSTANCE is set (see lib/brand.ts). The pages Meta App Review
// needs — /privacy, /terms, /data-deletion, /meta-review — are deliberately
// NOT in this list and stay public in every mode.
const MARKETING_PREFIXES = [
  "/manychat-alternative",
  "/comment-link-automation",
  "/instagram-comment-to-dm-templates",
  "/instagram-dm-automation-agencies",
  "/templates",
];

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function isPrivateInstance(): boolean {
  const raw = process.env.APP_PRIVATE_INSTANCE?.trim().toLowerCase();
  return raw ? TRUTHY.has(raw) : false;
}

function hasSessionCookie(request: NextRequest): boolean {
  return (
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token") ||
    request.cookies.has("next-auth.session-token") ||
    request.cookies.has("__Secure-next-auth.session-token")
  );
}

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthenticated = hasSessionCookie(request);
  const isLogin = pathname === "/login";

  if (matchesPrefix(pathname, PROTECTED_PREFIXES) && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLogin && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Private instance: the marketing landing and SEO pages do not apply. Send
  // visitors to where they can actually act.
  if (isPrivateInstance()) {
    const isMarketingRoot = pathname === "/";
    if (isMarketingRoot || matchesPrefix(pathname, MARKETING_PREFIXES)) {
      const target = isAuthenticated ? "/dashboard" : "/login";
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/overview/:path*",
    "/inbox/:path*",
    "/campaigns/:path*",
    "/automations/:path*",
    "/logs/:path*",
    "/settings/:path*",
    "/diagnostics/:path*",
    "/login",
    "/manychat-alternative",
    "/comment-link-automation",
    "/instagram-comment-to-dm-templates",
    "/instagram-dm-automation-agencies",
    "/templates",
    "/templates/:path*",
  ],
};
