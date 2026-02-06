/**
 * Metrics Repository
 *
 * Tracks API performance metrics for monitoring and debugging.
 * All writes are non-blocking to avoid impacting response latency.
 */

import { sql } from './index';
import type {
  ApiMetric,
  CreateMetricInput,
  ApiHealthStats,
  MetricsQueryOptions
} from './schema';

/**
 * Log an API metric (fire-and-forget, non-blocking)
 * Wrapped in try-catch to never throw - logging failures shouldn't break API
 */
export async function logApiMetric(input: CreateMetricInput): Promise<void> {
  try {
    const metadata = input.request_metadata ? JSON.stringify(input.request_metadata) : null;

    await sql`
      INSERT INTO api_metrics (
        endpoint, session_id, latency_ms, status_code,
        success, error_message, request_metadata
      )
      VALUES (
        ${input.endpoint},
        ${input.session_id || null},
        ${input.latency_ms},
        ${input.status_code},
        ${input.success},
        ${input.error_message || null},
        ${metadata}::jsonb
      )
    `;
  } catch (error) {
    console.error('Failed to log API metric:', error);
    // Never throw - this is fire-and-forget
  }
}

/**
 * Get API health stats (last N hours)
 */
export async function getApiHealth(hours: number = 24): Promise<ApiHealthStats[]> {
  try {
    const result = await sql`
      SELECT
        endpoint,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN success THEN 1 END) as successful_requests,
        ROUND(100.0 * COUNT(CASE WHEN success THEN 1 END) / NULLIF(COUNT(*), 0), 2) as success_rate,
        ROUND(AVG(latency_ms)::numeric, 2) as avg_latency_ms,
        MAX(latency_ms) as max_latency_ms,
        MIN(latency_ms) as min_latency_ms
      FROM api_metrics
      WHERE created_at > NOW() - (${hours} || ' hours')::interval
      GROUP BY endpoint
      ORDER BY total_requests DESC
    `;

    return result.rows.map(row => ({
      endpoint: row.endpoint,
      total_requests: parseInt(row.total_requests),
      successful_requests: parseInt(row.successful_requests),
      success_rate: parseFloat(row.success_rate) || 0,
      avg_latency_ms: parseFloat(row.avg_latency_ms) || 0,
      max_latency_ms: parseInt(row.max_latency_ms) || 0,
      min_latency_ms: parseInt(row.min_latency_ms) || 0
    }));
  } catch (error) {
    console.error('Error fetching API health:', error);
    return [];
  }
}

/**
 * Get recent errors
 */
export async function getRecentErrors(
  limit: number = 20
): Promise<ApiMetric[]> {
  try {
    const result = await sql`
      SELECT * FROM api_metrics
      WHERE success = false
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return result.rows.map(mapRowToMetric);
  } catch (error) {
    console.error('Error fetching recent errors:', error);
    return [];
  }
}

/**
 * Get metrics by endpoint
 */
export async function getMetricsByEndpoint(
  endpoint: string,
  options: MetricsQueryOptions = {}
): Promise<ApiMetric[]> {
  const { limit = 50, offset = 0, start_date, end_date } = options;

  try {
    let result;

    if (start_date && end_date) {
      const startStr = start_date.toISOString();
      const endStr = end_date.toISOString();
      result = await sql`
        SELECT * FROM api_metrics
        WHERE endpoint = ${endpoint}
          AND created_at BETWEEN ${startStr}::timestamp AND ${endStr}::timestamp
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else {
      result = await sql`
        SELECT * FROM api_metrics
        WHERE endpoint = ${endpoint}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    }

    return result.rows.map(mapRowToMetric);
  } catch (error) {
    console.error('Error fetching metrics by endpoint:', error);
    return [];
  }
}

/**
 * Get latency percentiles for an endpoint
 */
export async function getLatencyPercentiles(
  endpoint: string,
  hours: number = 24
): Promise<{ p50: number; p90: number; p95: number; p99: number }> {
  try {
    const result = await sql`
      SELECT
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency_ms) as p50,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY latency_ms) as p90,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency_ms) as p99
      FROM api_metrics
      WHERE endpoint = ${endpoint}
        AND created_at > NOW() - (${hours} || ' hours')::interval
    `;

    const row = result.rows[0];
    return {
      p50: parseFloat(row?.p50) || 0,
      p90: parseFloat(row?.p90) || 0,
      p95: parseFloat(row?.p95) || 0,
      p99: parseFloat(row?.p99) || 0
    };
  } catch (error) {
    console.error('Error fetching latency percentiles:', error);
    return { p50: 0, p90: 0, p95: 0, p99: 0 };
  }
}

/**
 * Get hourly request counts (for charts)
 */
export async function getHourlyRequestCounts(
  hours: number = 24
): Promise<{ hour: Date; total: number; successful: number; failed: number }[]> {
  try {
    const result = await sql`
      SELECT
        DATE_TRUNC('hour', created_at) as hour,
        COUNT(*) as total,
        COUNT(CASE WHEN success THEN 1 END) as successful,
        COUNT(CASE WHEN NOT success THEN 1 END) as failed
      FROM api_metrics
      WHERE created_at > NOW() - (${hours} || ' hours')::interval
      GROUP BY DATE_TRUNC('hour', created_at)
      ORDER BY hour
    `;

    return result.rows.map(row => ({
      hour: new Date(row.hour),
      total: parseInt(row.total),
      successful: parseInt(row.successful),
      failed: parseInt(row.failed)
    }));
  } catch (error) {
    console.error('Error fetching hourly request counts:', error);
    return [];
  }
}

/**
 * Get total metrics count
 */
export async function getMetricsCount(): Promise<number> {
  try {
    const result = await sql`SELECT COUNT(*) as count FROM api_metrics`;
    return parseInt(result.rows[0]?.count || '0');
  } catch (error) {
    console.error('Error counting metrics:', error);
    return 0;
  }
}

/**
 * Get average latency by endpoint (last N hours)
 */
export async function getAverageLatencyByEndpoint(
  hours: number = 24
): Promise<{ endpoint: string; avg_latency_ms: number }[]> {
  try {
    const result = await sql`
      SELECT
        endpoint,
        ROUND(AVG(latency_ms)::numeric, 2) as avg_latency_ms
      FROM api_metrics
      WHERE created_at > NOW() - (${hours} || ' hours')::interval
      GROUP BY endpoint
      ORDER BY avg_latency_ms DESC
    `;

    return result.rows.map(row => ({
      endpoint: row.endpoint,
      avg_latency_ms: parseFloat(row.avg_latency_ms) || 0
    }));
  } catch (error) {
    console.error('Error fetching average latency:', error);
    return [];
  }
}

// Helper to map database row to TypeScript type
function mapRowToMetric(row: Record<string, unknown>): ApiMetric {
  return {
    id: row.id as number,
    endpoint: row.endpoint as string,
    session_id: row.session_id as string | null,
    latency_ms: row.latency_ms as number,
    status_code: row.status_code as number,
    success: row.success as boolean,
    error_message: row.error_message as string | null,
    request_metadata: row.request_metadata as ApiMetric['request_metadata'],
    created_at: new Date(row.created_at as string)
  };
}
