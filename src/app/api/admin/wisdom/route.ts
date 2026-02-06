/**
 * Admin API: Daily Wisdom Data
 *
 * GET /api/admin/wisdom - Fetch wisdom entries for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRecentWisdom, getWisdomStats, getWisdomByTextType } from '@/lib/db/wisdomRepository';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Fetch wisdom data in parallel
    const [recentWisdom, stats, byTextType] = await Promise.all([
      getRecentWisdom({ limit, offset }),
      getWisdomStats(),
      getWisdomByTextType()
    ]);

    return NextResponse.json({
      success: true,
      data: {
        entries: recentWisdom.map(w => ({
          id: w.id,
          date: w.wisdom_date.toISOString().split('T')[0],
          source: w.source_name,
          chapter: w.chapter,
          section: w.section,
          textType: w.text_type,
          rawTextPreview: w.raw_text.substring(0, 150) + (w.raw_text.length > 150 ? '...' : ''),
          interpretationPreview: w.interpretation.substring(0, 150) + (w.interpretation.length > 150 ? '...' : ''),
          createdAt: w.created_at.toISOString()
        })),
        stats: {
          totalEntries: stats.total_entries,
          uniqueTextTypes: stats.unique_text_types,
          earliestDate: stats.earliest_date?.toISOString().split('T')[0],
          latestDate: stats.latest_date?.toISOString().split('T')[0]
        },
        byTextType
      },
      pagination: {
        limit,
        offset,
        hasMore: recentWisdom.length === limit
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin wisdom API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch wisdom data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
