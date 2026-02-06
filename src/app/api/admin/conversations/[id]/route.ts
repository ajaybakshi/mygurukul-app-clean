/**
 * Admin API: Single Conversation Entry by ID
 *
 * GET /api/admin/conversations/[id] - Fetch full conversation details (no truncation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConversationById } from '@/lib/db/conversationRepository';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id) || id <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid conversation ID' },
        { status: 400 }
      );
    }

    const conversation = await getConversationById(id);

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: conversation.id,
        sessionId: conversation.session_id,
        question: conversation.question,           // Full question, not truncated
        responseNarrative: conversation.response_narrative, // Full response, not truncated
        citations: conversation.citations,         // Full citations array
        provider: conversation.provider,
        responseTimeMs: conversation.response_time_ms,
        grounded: conversation.grounded,
        createdAt: conversation.created_at.toISOString()
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Admin conversation detail API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch conversation details',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
