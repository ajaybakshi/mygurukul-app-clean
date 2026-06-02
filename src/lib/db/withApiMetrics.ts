/**
 * withApiMetrics — route handler wrapper that records an api_metrics row
 * for every request (latency, status, success/error), awaited so the write
 * isn't lost when Vercel freezes the serverless instance after the response.
 *
 * Usage:
 *   export const POST = withApiMetrics('/api/audio/generate', async (req) => {
 *     ...
 *     return NextResponse.json(...);
 *   });
 *
 * Keep instrumentation consistent across routes instead of hand-writing
 * logApiMetric in every handler. Errors thrown by the handler are logged as
 * a 500 metric and re-thrown so Next.js still renders its error response.
 */

import type { NextRequest } from 'next/server';
import { logApiMetric } from './metricsRepository';

type RouteContext = { params?: Record<string, string | string[]> };
type RouteHandler = (req: NextRequest, ctx: RouteContext) => Promise<Response>;

export function withApiMetrics(endpoint: string, handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, ctx: RouteContext): Promise<Response> => {
    const start = Date.now();
    try {
      const res = await handler(req, ctx);
      await logApiMetric({
        endpoint,
        latency_ms: Date.now() - start,
        status_code: res.status,
        success: res.status < 400,
        request_metadata: { method: req.method },
      }).catch(() => {});
      return res;
    } catch (err) {
      await logApiMetric({
        endpoint,
        latency_ms: Date.now() - start,
        status_code: 500,
        success: false,
        error_message: err instanceof Error ? err.message : 'Unknown error',
        request_metadata: { method: req.method },
      }).catch(() => {});
      throw err;
    }
  };
}
