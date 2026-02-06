/**
 * Admin API: API Metrics Data
 *
 * GET /api/admin/metrics - Fetch performance metrics for admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getApiHealth,
  getRecentErrors,
  getHourlyRequestCounts,
  getMetricsCount,
  getAverageLatencyByEndpoint,
  getLatencyPercentiles
} from '@/lib/db/metricsRepository';
import { checkDatabaseConnection, getDatabaseStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24');
    const endpoint = searchParams.get('endpoint') || undefined;

    // Health check first
    const dbConnected = await checkDatabaseConnection();

    if (!dbConnected) {
      return NextResponse.json({
        success: false,
        error: 'Database connection failed',
        dbStatus: {
          connected: false,
          message: 'Unable to connect to Vercel Postgres'
        }
      }, { status: 503 });
    }

    // Fetch metrics data in parallel
    const [
      apiHealth,
      recentErrors,
      hourlyRequests,
      totalMetrics,
      avgLatency,
      dbStats
    ] = await Promise.all([
      getApiHealth(hours),
      getRecentErrors(10),
      getHourlyRequestCounts(hours),
      getMetricsCount(),
      getAverageLatencyByEndpoint(hours),
      getDatabaseStats()
    ]);

    // Get latency percentiles for a specific endpoint if requested
    let percentiles = null;
    if (endpoint) {
      percentiles = await getLatencyPercentiles(endpoint, hours);
    }

    return NextResponse.json({
      success: true,
      data: {
        health: apiHealth.map(h => ({
          endpoint: h.endpoint,
          totalRequests: h.total_requests,
          successfulRequests: h.successful_requests,
          successRate: h.success_rate,
          avgLatencyMs: Math.round(h.avg_latency_ms),
          maxLatencyMs: h.max_latency_ms,
          minLatencyMs: h.min_latency_ms
        })),
        recentErrors: recentErrors.map(e => ({
          id: e.id,
          endpoint: e.endpoint,
          statusCode: e.status_code,
          errorMessage: e.error_message?.substring(0, 100),
          latencyMs: e.latency_ms,
          createdAt: e.created_at.toISOString()
        })),
        hourlyRequests: hourlyRequests.map(h => ({
          hour: h.hour.toISOString(),
          total: h.total,
          successful: h.successful,
          failed: h.failed
        })),
        summary: {
          totalMetrics,
          averageLatencyByEndpoint: avgLatency,
          ...(percentiles && { percentiles })
        },
        database: dbStats
      },
      meta: {
        timeRangeHours: hours,
        queriedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Admin metrics API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch metrics data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
