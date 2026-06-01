import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const publicPaths = ["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/forgot-pin", "/api/auth/reset-pin", "/recuperar-pin"];
const csrfBypassPaths = ["/api/ai/"];
const CSRF_COOKIE = "csrf-token";
const CSRF_HEADER = "x-csrf-token";
const STATE_CHANGING = ["POST", "PUT", "DELETE", "PATCH"];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/chat")) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const user = await verifyToken(token);
      if (user) return NextResponse.next();
    }
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const token = request.cookies.get("atlas-edu-token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const user = await verifyToken(token);
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/teacher") && user.role !== "teacher" && user.role !== "admin") {
    return NextResponse.redirect(new URL("/student/dashboard", request.url));
  }
  if (pathname.startsWith("/student") && user.role !== "student" && user.role !== "admin") {
    return NextResponse.redirect(new URL("/teacher/dashboard", request.url));
  }
  if (pathname.startsWith("/parent") && user.role !== "parent" && user.role !== "admin") {
    return NextResponse.redirect(new URL("/student/dashboard", request.url));
  }
  if (pathname.startsWith("/admin") && user.role !== "admin") {
    return NextResponse.redirect(new URL("/teacher/dashboard", request.url));
  }

  const encodedPayload = btoa(JSON.stringify({
    id: user.id, cedula: user.cedula, fullName: user.fullName, role: user.role,
  }));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-payload", encodedPayload);
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (method === "GET" && !request.cookies.get(CSRF_COOKIE)) {
    const csrfToken = crypto.randomUUID();
    response.cookies.set(CSRF_COOKIE, csrfToken, {
      httpOnly: false,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 86400,
    });
  }

  if (STATE_CHANGING.includes(method) && pathname.startsWith("/api/") && !csrfBypassPaths.some(p => pathname.startsWith(p))) {
    const headerToken = request.headers.get(CSRF_HEADER);
    const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;

    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      return NextResponse.json({ error: "Token CSRF invalido" }, { status: 403 });
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)"],
};
