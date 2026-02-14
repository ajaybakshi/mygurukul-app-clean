/**
 * Wisdom Batch Health Check — Vercel Cron Job
 *
 * Runs weekly to monitor batch depletion and log warnings.
 * Secured by CRON_SECRET (Vercel automatically sends this header).
 *
 * Cron schedule: Every Sunday at 8:00 AM UTC
 */

import { NextRequest, NextResponse } from 'next/server';
import * as wisdomBatchService from '@/lib/tei/wisdomBatchService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret (Vercel sends this automatically)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const status = await wisdomBatchService.getBatchStatus();
    const message = status.needsRefresh
      ? `WARNING: Only ${status.remaining} wisdom cards remaining out of ${status.total}. Regenerate batch soon.`
      : `OK: ${status.remaining} wisdom cards remaining out of ${status.total}.`;

    console.log(`[Cron:wisdom-health] ${message}`);

    return NextResponse.json({
      ok: !status.needsRefresh,
      ...status,
      message,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Cron:wisdom-health] Error:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
