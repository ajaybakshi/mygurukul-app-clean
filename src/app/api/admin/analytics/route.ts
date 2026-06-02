/**
 * Admin API: User Analytics
 *
 * GET /api/admin/analytics?days=30 - Session-based engagement analytics
 * derived from the conversations table. Pseudo-anonymous (session_id only).
 *
 * Protected by middleware (ADMIN_SECRET_TOKEN via ?token=).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getEngagementSummary,
  getDailyConversationVolume,
  getNewSessionsPerDay,
  getRetentionSplit,
  getQueriesPerSessionDistribution,
  getProviderMix,
} from '@/lib/db/analyticsRepository';
import { getPopularQuestions } from '@/lib/db/conversationRepository';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30'), 1), 365);

    const [
      summary,
      dailyVolume,
      newSessions,
      retention,
      queriesPerSession,
      providerMix,
      popularQuestions,
    ] = await Promise.all([
      getEngagementSummary(days),
      getDailyConversationVolume(days),
      getNewSessionsPerDay(days),
      getRetentionSplit(days),
      getQueriesPerSessionDistribution(days),
      getProviderMix(days),
      getPopularQuestions(10),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        summary,
        dailyVolume,
        newSessions,
        retention,
        queriesPerSession,
        providerMix,
        popularQuestions,
      },
      meta: {
        windowDays: days,
        note: 'Sessions are pseudo-anonymous (per-browser id). Geo/device available via Vercel Analytics.',
        queriedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Admin analytics API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analytics data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
