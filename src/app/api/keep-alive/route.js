import { supabaseClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

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
    // Perform a lightweight query on the 'applicants' table to wake/keep the DB alive
    const { data, error } = await supabaseClient
      .from('applicants')
      .select('id')
      .limit(1);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      status: 'success',
      message: 'Keep-alive query executed successfully.',
      timestamp: new Date().toISOString(),
      recordFetched: data.length > 0 ? 'yes' : 'no'
    });
  } catch (err) {
    console.error('[Cron Keep-Alive] Database query failed:', err.message || err);
    return NextResponse.json(
      { status: 'error', message: err.message || 'Database connection error' },
      { status: 500 }
    );
  }
}
