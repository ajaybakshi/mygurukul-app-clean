/**
 * Wisdom Repository
 *
 * Handles daily wisdom persistence - saving generated wisdom
 * and retrieving cached wisdom to avoid regeneration.
 */

import { sql } from './index';
import type {
  DailyWisdom,
  CreateWisdomInput,
  WisdomStats,
  PaginationOptions,
  DateRangeOptions
} from './schema';

/**
 * Get wisdom by ID (for admin detail view)
 * Returns full wisdom entry without truncation
 */
export async function getWisdomById(id: number): Promise<DailyWisdom | null> {
  try {
    const result = await sql`
      SELECT * FROM daily_wisdom
      WHERE id = ${id}
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToWisdom(result.rows[0]);
  } catch (error) {
    console.error('Error fetching wisdom by ID:', error);
    return null;
  }
}

/**
 * Get wisdom by date (for cache check)
 * Returns null if no wisdom exists for that date
 */
export async function getWisdomByDate(date: Date): Promise<DailyWisdom | null> {
  try {
    const dateStr = date.toISOString().split('T')[0];
    const result = await sql`
      SELECT * FROM daily_wisdom
      WHERE wisdom_date = ${dateStr}::date
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return mapRowToWisdom(result.rows[0]);
  } catch (error) {
    console.error('Error fetching wisdom by date:', error);
    return null;
  }
}

/**
 * Save new wisdom entry
 * Uses UPSERT to handle duplicate dates gracefully
 */
export async function saveWisdom(input: CreateWisdomInput): Promise<DailyWisdom | null> {
  try {
    const dateStr = input.wisdom_date.toISOString().split('T')[0];
    const metadata = input.metadata ? JSON.stringify(input.metadata) : null;

    const result = await sql`
      INSERT INTO daily_wisdom (
        wisdom_date, raw_text, interpretation, source_name,
        chapter, section, text_type, metadata
      )
      VALUES (
        ${dateStr}::date,
        ${input.raw_text},
        ${input.interpretation},
        ${input.source_name},
        ${input.chapter || null},
        ${input.section || null},
        ${input.text_type || null},
        ${metadata}::jsonb
      )
      ON CONFLICT (wisdom_date) DO UPDATE SET
        raw_text = EXCLUDED.raw_text,
        interpretation = EXCLUDED.interpretation,
        source_name = EXCLUDED.source_name,
        chapter = EXCLUDED.chapter,
        section = EXCLUDED.section,
        text_type = EXCLUDED.text_type,
        metadata = EXCLUDED.metadata
      RETURNING *
    `;

    return mapRowToWisdom(result.rows[0]);
  } catch (error) {
    console.error('Error saving wisdom:', error);
    return null;
  }
}

/**
 * Get recent wisdom entries (for admin dashboard)
 */
export async function getRecentWisdom(
  options: PaginationOptions = {}
): Promise<DailyWisdom[]> {
  const { limit = 10, offset = 0 } = options;

  try {
    const result = await sql`
      SELECT * FROM daily_wisdom
      ORDER BY wisdom_date DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return result.rows.map(mapRowToWisdom);
  } catch (error) {
    console.error('Error fetching recent wisdom:', error);
    return [];
  }
}

/**
 * Get wisdom by date range
 */
export async function getWisdomByDateRange(
  options: DateRangeOptions & PaginationOptions
): Promise<DailyWisdom[]> {
  const { start_date, end_date, limit = 30, offset = 0 } = options;

  try {
    let result;

    if (start_date && end_date) {
      const startStr = start_date.toISOString().split('T')[0];
      const endStr = end_date.toISOString().split('T')[0];
      result = await sql`
        SELECT * FROM daily_wisdom
        WHERE wisdom_date BETWEEN ${startStr}::date AND ${endStr}::date
        ORDER BY wisdom_date DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else {
      result = await sql`
        SELECT * FROM daily_wisdom
        ORDER BY wisdom_date DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    }

    return result.rows.map(mapRowToWisdom);
  } catch (error) {
    console.error('Error fetching wisdom by date range:', error);
    return [];
  }
}

/**
 * Get wisdom statistics
 */
export async function getWisdomStats(): Promise<WisdomStats> {
  try {
    const result = await sql`
      SELECT
        COUNT(*) as total_entries,
        COUNT(DISTINCT text_type) as unique_text_types,
        MIN(wisdom_date) as earliest_date,
        MAX(wisdom_date) as latest_date
      FROM daily_wisdom
    `;

    const row = result.rows[0];
    return {
      total_entries: parseInt(row.total_entries || '0'),
      unique_text_types: parseInt(row.unique_text_types || '0'),
      earliest_date: row.earliest_date ? new Date(row.earliest_date) : null,
      latest_date: row.latest_date ? new Date(row.latest_date) : null
    };
  } catch (error) {
    console.error('Error fetching wisdom stats:', error);
    return {
      total_entries: 0,
      unique_text_types: 0,
      earliest_date: null,
      latest_date: null
    };
  }
}

/**
 * Get wisdom grouped by text type
 */
export async function getWisdomByTextType(): Promise<{ text_type: string; count: number }[]> {
  try {
    const result = await sql`
      SELECT text_type, COUNT(*) as count
      FROM daily_wisdom
      WHERE text_type IS NOT NULL
      GROUP BY text_type
      ORDER BY count DESC
    `;

    return result.rows.map(row => ({
      text_type: row.text_type,
      count: parseInt(row.count)
    }));
  } catch (error) {
    console.error('Error fetching wisdom by text type:', error);
    return [];
  }
}

// Helper to map database row to TypeScript type
function mapRowToWisdom(row: Record<string, unknown>): DailyWisdom {
  return {
    id: row.id as number,
    wisdom_date: new Date(row.wisdom_date as string),
    raw_text: row.raw_text as string,
    interpretation: row.interpretation as string,
    source_name: row.source_name as string,
    chapter: row.chapter as string | null,
    section: row.section as string | null,
    text_type: row.text_type as string | null,
    metadata: row.metadata as DailyWisdom['metadata'],
    created_at: new Date(row.created_at as string)
  };
}
