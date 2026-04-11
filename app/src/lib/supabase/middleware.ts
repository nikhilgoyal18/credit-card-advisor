/**
 * Session refresh middleware
 * Updates session cookies from Supabase auth
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /wallet and /admin routes
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = pathname.startsWith('/wallet') || pathname.startsWith('/admin');

  if (isProtectedRoute && !user) {
    // Redirect unauthenticated users to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect authenticated users from auth pages to home
  if ((pathname === '/login' || pathname === '/signup') && user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return supabaseResponse;
}
