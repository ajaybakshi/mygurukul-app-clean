/**
 * Admin API: Conversations Data
 *
 * GET /api/admin/conversations - Fetch Q&A data for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getRecentConversations,
  getConversationStats,
  getConversationCount,
  getUniqueSessionCount,
  getPopularQuestions
} from '@/lib/db/conversationRepository';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const provider = searchParams.get('provider') || undefined;
    const days = parseInt(searchParams.get('days') || '7');

    // Fetch conversation data in parallel
    const [conversations, stats, totalCount, uniqueSessions, popularQuestions] = await Promise.all([
      getRecentConversations({ limit, offset, provider }),
      getConversationStats(days),
      getConversationCount(),
      getUniqueSessionCount(30),
      getPopularQuestions(10)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        conversations: conversations.map(c => ({
          id: c.id,
          sessionId: c.session_id.substring(0, 8) + '...',
          question: c.question.substring(0, 100) + (c.question.length > 100 ? '...' : ''),
          responsePreview: c.response_narrative?.substring(0, 150) + (c.response_narrative && c.response_narrative.length > 150 ? '...' : ''),
          provider: c.provider,
          responseTimeMs: c.response_time_ms,
          grounded: c.grounded,
          citationsCount: c.citations?.length || 0,
          createdAt: c.created_at.toISOString()
        })),
        stats: {
          totalConversations: totalCount,
          uniqueSessions30d: uniqueSessions,
          byProvider: stats,
          popularQuestions
        }
      },
      pagination: {
        limit,
        offset,
        hasMore: conversations.length === limit
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin conversations API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch conversation data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
