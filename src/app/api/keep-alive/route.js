import { supabaseClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// Force Next.js to execute this API dynamically on every request (prevent static build caching)
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Verify that the request is authorized (by Vercel's Cron runner)
  // In a local development environment where CRON_SECRET is not defined, we skip this check to make testing easier.
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // Perform an ultra-lightweight ping query using head: true
    const { count, error } = await supabaseClient
      .from('applicants')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    // Call the PostgreSQL function to delete old attachments (older than 3 months)
    const { error: rpcError } = await supabaseClient.rpc('delete_old_attachments');
    if (rpcError) {
      console.error('[Cron Keep-Alive] Failed to clean up old attachments:', rpcError.message);
    }

    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      recordCount: count,
    });
  } catch (err) {
    console.error('[Cron Keep-Alive] Database query failed:', err.message || err);
    return NextResponse.json(
      { status: 'error', message: err.message || 'Database connection error' },
      { status: 500 }
    );
  }
}
