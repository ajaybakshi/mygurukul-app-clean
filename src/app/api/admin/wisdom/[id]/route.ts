/**
 * Admin API: Single Wisdom Entry by ID
 *
 * GET /api/admin/wisdom/[id] - Fetch full wisdom details (no truncation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWisdomById } from '@/lib/db/wisdomRepository';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid wisdom ID' },
        { status: 400 }
      );
    }

    const wisdom = await getWisdomById(id);

    if (!wisdom) {
      return NextResponse.json(
        { success: false, error: 'Wisdom entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: wisdom.id,
        date: wisdom.wisdom_date.toISOString().split('T')[0],
        source: wisdom.source_name,
        chapter: wisdom.chapter,
        section: wisdom.section,
        textType: wisdom.text_type,
        rawText: wisdom.raw_text,           // Full text, not truncated
        interpretation: wisdom.interpretation, // Full interpretation, not truncated
        metadata: wisdom.metadata,
        createdAt: wisdom.created_at.toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin wisdom detail API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch wisdom details',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
