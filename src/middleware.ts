import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for Admin Dashboard Authentication
 *
 * Protects /admin routes with a simple token-based auth.
 * Token is passed as a query parameter: ?token=SECRET
 */
export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Only protect /admin routes (pages) and /api/admin routes (data APIs)
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const token = searchParams.get('token');
    const adminToken = process.env.ADMIN_SECRET_TOKEN;

    // If no admin token is configured, deny all access
    if (!adminToken) {
      console.warn('ADMIN_SECRET_TOKEN not configured - admin access disabled');
      return NextResponse.json(
        { error: 'Admin access is not configured' },
        { status: 503 }
      );
    }

    // Check if token matches
    if (!token || token !== adminToken) {
      return NextResponse.json(
        { error: 'Unauthorized. Please provide a valid token.' },
        { status: 401 }
      );
    }

    // Token is valid, allow request to proceed
    // Add a header to indicate authentication was successful
    const response = NextResponse.next();
    response.headers.set('X-Admin-Authenticated', 'true');
    return response;
  }

  // Non-admin routes pass through
  return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    // Match all admin routes
    '/admin/:path*',
    '/api/admin/:path*'
  ]
};
