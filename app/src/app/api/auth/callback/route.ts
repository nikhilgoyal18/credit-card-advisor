/**
 * Auth callback handler
 * Processes Supabase auth callbacks (email confirmations, password resets, etc)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Return to an error page if code is missing or invalid
  return NextResponse.redirect(new URL('/auth-error', request.url));
}
