/**
 * Conversation Repository
 *
 * Tracks Q&A interactions for analytics and debugging.
 * Non-blocking writes to avoid impacting response latency.
 */

import { sql } from './index';
import type {
  Conversation,
  CreateConversationInput,
  ConversationStats,
  ConversationQueryOptions
} from './schema';

/**
 * Save a conversation (fire-and-forget, non-blocking)
 * Wrapped in try-catch to never throw - logging failures shouldn't break API
 */
export async function logConversation(input: CreateConversationInput): Promise<void> {
  try {
    const citations = input.citations ? JSON.stringify(input.citations) : null;

    await sql`
      INSERT INTO conversations (
        session_id, question, response_narrative, citations,
        provider, response_time_ms, grounded
      )
      VALUES (
        ${input.session_id},
        ${input.question},
        ${input.response_narrative || null},
        ${citations}::jsonb,
        ${input.provider || null},
        ${input.response_time_ms || null},
        ${input.grounded || false}
      )
    `;
  } catch (error) {
    console.error('Failed to log conversation:', error);
    // Never throw - this is fire-and-forget
  }
}

/**
 * Get conversations by session ID
 */
export async function getConversationsBySession(
  sessionId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<Conversation[]> {
  const { limit = 50, offset = 0 } = options;

  try {
    const result = await sql`
      SELECT * FROM conversations
      WHERE session_id = ${sessionId}
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return result.rows.map(mapRowToConversation);
  } catch (error) {
    console.error('Error fetching conversations by session:', error);
    return [];
  }
}

/**
 * Get recent conversations (for admin dashboard)
 */
export async function getRecentConversations(
  options: ConversationQueryOptions = {}
): Promise<Conversation[]> {
  const { limit = 20, offset = 0, provider, start_date, end_date } = options;

  try {
    let result;

    if (provider && start_date && end_date) {
      const startStr = start_date.toISOString();
      const endStr = end_date.toISOString();
      result = await sql`
        SELECT * FROM conversations
        WHERE provider = ${provider}
          AND created_at BETWEEN ${startStr}::timestamp AND ${endStr}::timestamp
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else if (provider) {
      result = await sql`
        SELECT * FROM conversations
        WHERE provider = ${provider}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else if (start_date && end_date) {
      const startStr = start_date.toISOString();
      const endStr = end_date.toISOString();
      result = await sql`
        SELECT * FROM conversations
        WHERE created_at BETWEEN ${startStr}::timestamp AND ${endStr}::timestamp
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else {
      result = await sql`
        SELECT * FROM conversations
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    }

    return result.rows.map(mapRowToConversation);
  } catch (error) {
    console.error('Error fetching recent conversations:', error);
    return [];
  }
}

/**
 * Get conversation statistics by provider
 */
export async function getConversationStats(
  days: number = 7
): Promise<ConversationStats[]> {
  try {
    const result = await sql`
      SELECT
        provider,
        COUNT(*) as total_conversations,
        AVG(response_time_ms) as avg_response_time_ms,
        COUNT(CASE WHEN grounded THEN 1 END) as grounded_count,
        DATE(created_at) as date
      FROM conversations
      WHERE created_at > NOW() - (${days} || ' days')::interval
      GROUP BY provider, DATE(created_at)
      ORDER BY date DESC, provider
    `;

    return result.rows.map(row => ({
      provider: row.provider || 'unknown',
      total_conversations: parseInt(row.total_conversations),
      avg_response_time_ms: parseFloat(row.avg_response_time_ms) || 0,
      grounded_count: parseInt(row.grounded_count),
      date: new Date(row.date)
    }));
  } catch (error) {
    console.error('Error fetching conversation stats:', error);
    return [];
  }
}

/**
 * Get total conversation count
 */
export async function getConversationCount(): Promise<number> {
  try {
    const result = await sql`SELECT COUNT(*) as count FROM conversations`;
    return parseInt(result.rows[0]?.count || '0');
  } catch (error) {
    console.error('Error counting conversations:', error);
    return 0;
  }
}

/**
 * Get unique session count
 */
export async function getUniqueSessionCount(days: number = 30): Promise<number> {
  try {
    const result = await sql`
      SELECT COUNT(DISTINCT session_id) as count
      FROM conversations
      WHERE created_at > NOW() - (${days} || ' days')::interval
    `;
    return parseInt(result.rows[0]?.count || '0');
  } catch (error) {
    console.error('Error counting unique sessions:', error);
    return 0;
  }
}

/**
 * Get most common questions (for analysis)
 */
export async function getPopularQuestions(
  limit: number = 10
): Promise<{ question: string; count: number }[]> {
  try {
    // Group by first 100 chars of question for similarity
    const result = await sql`
      SELECT
        SUBSTRING(question, 1, 100) as question_prefix,
        COUNT(*) as count
      FROM conversations
      GROUP BY SUBSTRING(question, 1, 100)
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    return result.rows.map(row => ({
      question: row.question_prefix,
      count: parseInt(row.count)
    }));
  } catch (error) {
    console.error('Error fetching popular questions:', error);
    return [];
  }
}

// Helper to map database row to TypeScript type
function mapRowToConversation(row: Record<string, unknown>): Conversation {
  return {
    id: row.id as number,
    session_id: row.session_id as string,
    question: row.question as string,
    response_narrative: row.response_narrative as string | null,
    citations: row.citations as Conversation['citations'],
    provider: row.provider as string | null,
    response_time_ms: row.response_time_ms as number | null,
    grounded: row.grounded as boolean,
    created_at: new Date(row.created_at as string)
  };
}
