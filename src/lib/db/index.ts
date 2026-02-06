/**
 * Database Connection Module
 *
 * Uses Vercel Postgres for serverless PostgreSQL.
 * Connection is automatically managed by @vercel/postgres.
 */

import { sql } from '@vercel/postgres';

export { sql };

/**
 * Health check - verifies database connection
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const result = await sql`SELECT 1 as health_check`;
    return result.rows.length > 0;
  } catch (error) {
    console.error('Database connection check failed:', error);
    return false;
  }
}

/**
 * Get database stats for monitoring
 */
export async function getDatabaseStats() {
  try {
    const [wisdomCount, conversationCount, metricsCount] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM daily_wisdom`,
      sql`SELECT COUNT(*) as count FROM conversations`,
      sql`SELECT COUNT(*) as count FROM api_metrics`
    ]);

    return {
      connected: true,
      tables: {
        daily_wisdom: parseInt(wisdomCount.rows[0]?.count || '0'),
        conversations: parseInt(conversationCount.rows[0]?.count || '0'),
        api_metrics: parseInt(metricsCount.rows[0]?.count || '0')
      }
    };
  } catch (error) {
    console.error('Failed to get database stats:', error);
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
