/**
 * Analytics Repository
 *
 * Session-based user analytics derived from the `conversations` table.
 * Everything here is pseudo-anonymous: the only identity is `session_id`
 * (a per-browser id stored in localStorage). No IP, user-agent, or geo is
 * captured — geo/device live in Vercel Analytics separately.
 *
 * All queries are read-only and windowed by `days`.
 */

import { sql } from './index';

export interface EngagementSummary {
  total_conversations: number;
  unique_sessions: number;
  avg_queries_per_session: number;
  grounded_rate: number; // 0-100
  avg_response_ms: number;
}

export interface DailyPoint {
  day: string; // YYYY-MM-DD
  total: number;
  grounded: number;
}

export interface NewSessionPoint {
  day: string; // YYYY-MM-DD
  new_sessions: number;
}

export interface RetentionSplit {
  total_sessions: number;
  returning_sessions: number; // active on >1 distinct day in window
  one_time_sessions: number;
}

export interface QueriesPerSessionBucket {
  bucket: '1' | '2-3' | '4-10' | '10+';
  sessions: number;
}

export interface ProviderMix {
  provider: string;
  total: number;
  avg_latency_ms: number;
  grounded: number;
}

/** Headline engagement numbers for the window. */
export async function getEngagementSummary(days: number = 30): Promise<EngagementSummary> {
  try {
    const result = await sql`
      SELECT
        COUNT(*) AS total_conversations,
        COUNT(DISTINCT session_id) AS unique_sessions,
        COUNT(CASE WHEN grounded THEN 1 END) AS grounded_count,
        ROUND(AVG(response_time_ms)::numeric, 0) AS avg_response_ms
      FROM conversations
      WHERE created_at > NOW() - (${days} || ' days')::interval
    `;
    const r = result.rows[0] || {};
    const total = parseInt(r.total_conversations) || 0;
    const sessions = parseInt(r.unique_sessions) || 0;
    const grounded = parseInt(r.grounded_count) || 0;
    return {
      total_conversations: total,
      unique_sessions: sessions,
      avg_queries_per_session: sessions > 0 ? Math.round((total / sessions) * 10) / 10 : 0,
      grounded_rate: total > 0 ? Math.round((grounded / total) * 1000) / 10 : 0,
      avg_response_ms: parseInt(r.avg_response_ms) || 0,
    };
  } catch (error) {
    console.error('Error fetching engagement summary:', error);
    return {
      total_conversations: 0,
      unique_sessions: 0,
      avg_queries_per_session: 0,
      grounded_rate: 0,
      avg_response_ms: 0,
    };
  }
}

/** Conversation volume per day (total + grounded) for a trend chart. */
export async function getDailyConversationVolume(days: number = 30): Promise<DailyPoint[]> {
  try {
    const result = await sql`
      SELECT
        TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS day,
        COUNT(*) AS total,
        COUNT(CASE WHEN grounded THEN 1 END) AS grounded
      FROM conversations
      WHERE created_at > NOW() - (${days} || ' days')::interval
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at)
    `;
    return result.rows.map(r => ({
      day: r.day,
      total: parseInt(r.total) || 0,
      grounded: parseInt(r.grounded) || 0,
    }));
  } catch (error) {
    console.error('Error fetching daily conversation volume:', error);
    return [];
  }
}

/** New sessions per day (a session counts on the day it first appears). */
export async function getNewSessionsPerDay(days: number = 30): Promise<NewSessionPoint[]> {
  try {
    const result = await sql`
      SELECT
        TO_CHAR(DATE(first_seen), 'YYYY-MM-DD') AS day,
        COUNT(*) AS new_sessions
      FROM (
        SELECT session_id, MIN(created_at) AS first_seen
        FROM conversations
        GROUP BY session_id
      ) s
      WHERE first_seen > NOW() - (${days} || ' days')::interval
      GROUP BY DATE(first_seen)
      ORDER BY DATE(first_seen)
    `;
    return result.rows.map(r => ({
      day: r.day,
      new_sessions: parseInt(r.new_sessions) || 0,
    }));
  } catch (error) {
    console.error('Error fetching new sessions per day:', error);
    return [];
  }
}

/** One-time vs returning sessions (returning = active on >1 distinct day). */
export async function getRetentionSplit(days: number = 30): Promise<RetentionSplit> {
  try {
    const result = await sql`
      SELECT
        COUNT(*) AS total_sessions,
        COUNT(*) FILTER (WHERE active_days > 1) AS returning_sessions,
        COUNT(*) FILTER (WHERE active_days = 1) AS one_time_sessions
      FROM (
        SELECT session_id, COUNT(DISTINCT DATE(created_at)) AS active_days
        FROM conversations
        WHERE created_at > NOW() - (${days} || ' days')::interval
        GROUP BY session_id
      ) s
    `;
    const r = result.rows[0] || {};
    return {
      total_sessions: parseInt(r.total_sessions) || 0,
      returning_sessions: parseInt(r.returning_sessions) || 0,
      one_time_sessions: parseInt(r.one_time_sessions) || 0,
    };
  } catch (error) {
    console.error('Error fetching retention split:', error);
    return { total_sessions: 0, returning_sessions: 0, one_time_sessions: 0 };
  }
}

/** Distribution of how many questions each session asked. */
export async function getQueriesPerSessionDistribution(
  days: number = 30
): Promise<QueriesPerSessionBucket[]> {
  try {
    const result = await sql`
      SELECT
        CASE
          WHEN q = 1 THEN '1'
          WHEN q BETWEEN 2 AND 3 THEN '2-3'
          WHEN q BETWEEN 4 AND 10 THEN '4-10'
          ELSE '10+'
        END AS bucket,
        COUNT(*) AS sessions
      FROM (
        SELECT session_id, COUNT(*) AS q
        FROM conversations
        WHERE created_at > NOW() - (${days} || ' days')::interval
        GROUP BY session_id
      ) s
      GROUP BY bucket
    `;
    const order: QueriesPerSessionBucket['bucket'][] = ['1', '2-3', '4-10', '10+'];
    const map = new Map<string, number>(
      result.rows.map(r => [r.bucket as string, parseInt(r.sessions) || 0])
    );
    return order.map(bucket => ({ bucket, sessions: map.get(bucket) || 0 }));
  } catch (error) {
    console.error('Error fetching queries-per-session distribution:', error);
    return [];
  }
}

/** Conversation counts and quality by provider. */
export async function getProviderMix(days: number = 30): Promise<ProviderMix[]> {
  try {
    const result = await sql`
      SELECT
        COALESCE(provider, 'unknown') AS provider,
        COUNT(*) AS total,
        ROUND(AVG(response_time_ms)::numeric, 0) AS avg_latency_ms,
        COUNT(CASE WHEN grounded THEN 1 END) AS grounded
      FROM conversations
      WHERE created_at > NOW() - (${days} || ' days')::interval
      GROUP BY COALESCE(provider, 'unknown')
      ORDER BY total DESC
    `;
    return result.rows.map(r => ({
      provider: r.provider,
      total: parseInt(r.total) || 0,
      avg_latency_ms: parseInt(r.avg_latency_ms) || 0,
      grounded: parseInt(r.grounded) || 0,
    }));
  } catch (error) {
    console.error('Error fetching provider mix:', error);
    return [];
  }
}
