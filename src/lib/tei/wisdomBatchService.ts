/**
 * Wisdom Batch Service
 *
 * Runtime singleton that serves pre-computed wisdom cards from the batch file.
 * At request time, this is pure JSON lookup — no GCS, no parsing, no Gemini.
 *
 * Used card IDs are persisted in Postgres (via the daily_wisdom table's
 * metadata.tei_card_id field) so they survive serverless cold starts.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  WisdomBatch,
  WisdomIndex,
  WisdomTextMeta,
  PreparedWisdomCard,
} from './teiTypes';

// ─── Constants ───────────────────────────────────────────────────

const REPLENISH_THRESHOLD = 30;

// ─── Batch Status ────────────────────────────────────────────────

export interface BatchStatus {
  total: number;
  used: number;
  remaining: number;
  needsRefresh: boolean;
}

// ─── Singleton State ─────────────────────────────────────────────

let cachedBatch: WisdomBatch | null = null;
let cachedIndex: WisdomIndex | null = null;
let usedCardIdsRuntime: Set<string> = new Set();
let usedIdsRestoredFromDb = false;

// ─── File Paths ──────────────────────────────────────────────────

function getBatchPath(): string {
  return path.resolve(process.cwd(), 'public/wisdom-batch.json');
}

function getIndexPath(): string {
  return path.resolve(process.cwd(), 'public/wisdom-index.json');
}

// ─── Loaders ─────────────────────────────────────────────────────

function loadBatch(): WisdomBatch {
  if (cachedBatch) return cachedBatch;

  const batchPath = getBatchPath();
  if (!fs.existsSync(batchPath)) {
    throw new Error('wisdom-batch.json not found. Run `npm run build:wisdom-batch` first.');
  }

  cachedBatch = JSON.parse(fs.readFileSync(batchPath, 'utf-8'));
  return cachedBatch!;
}

function loadIndex(): WisdomIndex {
  if (cachedIndex) return cachedIndex;

  const indexPath = getIndexPath();
  if (!fs.existsSync(indexPath)) {
    throw new Error('wisdom-index.json not found. Run `npm run build:wisdom-index` first.');
  }

  cachedIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  return cachedIndex!;
}

/**
 * Restore used card IDs from Postgres (daily_wisdom table).
 * Called once per cold start before serving cards.
 */
async function restoreUsedIdsFromDb(): Promise<void> {
  if (usedIdsRestoredFromDb) return;

  try {
    const { sql } = await import('../db/index');
    const result = await sql`
      SELECT metadata->>'tei_card_id' as card_id
      FROM daily_wisdom
      WHERE metadata->>'tei_card_id' IS NOT NULL
    `;
    for (const row of result.rows) {
      if (row.card_id) {
        usedCardIdsRuntime.add(row.card_id as string);
      }
    }
    usedIdsRestoredFromDb = true;
    console.log(`[WisdomBatch] Restored ${usedCardIdsRuntime.size} used card IDs from DB`);
  } catch (err) {
    // DB might not be available in build/dev — proceed with empty set
    console.log('[WisdomBatch] Could not restore used IDs from DB (non-fatal):', err);
    usedIdsRestoredFromDb = true; // Don't retry
  }
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Get the next unused wisdom card from the pre-computed batch.
 * Cards are served sequentially (batch is pre-shuffled for diversity).
 * Restores used IDs from Postgres on first call (cold start).
 */
export async function getNextWisdomCard(options?: {
  textId?: string;
}): Promise<PreparedWisdomCard> {
  // Restore used IDs from DB on cold start
  await restoreUsedIdsFromDb();

  const batch = loadBatch();
  const available = batch.cards.filter(c => !usedCardIdsRuntime.has(c.id));

  if (available.length === 0) {
    // All cards used — reset rotation
    console.warn('[WisdomBatch] All cards used. Resetting rotation.');
    usedCardIdsRuntime.clear();
    usedIdsRestoredFromDb = false; // Allow re-check
    return getNextWisdomCard(options);
  }

  if (available.length <= REPLENISH_THRESHOLD) {
    console.warn(`[WisdomBatch] Low batch: ${available.length} cards remaining. Consider regenerating.`);
  }

  // If a specific text is requested, try to find a matching card
  let card: PreparedWisdomCard;
  if (options?.textId) {
    const matching = available.filter(c => c.textId === options.textId);
    card = matching.length > 0 ? matching[0] : available[0];
  } else {
    card = available[0];
  }

  // Mark as used (persisted to DB when route saves to daily_wisdom)
  usedCardIdsRuntime.add(card.id);

  return card;
}

/**
 * Get metadata for a specific text by ID.
 */
export function getTextMeta(textId: string): WisdomTextMeta {
  const index = loadIndex();
  const meta = index.texts.find(t => t.id === textId);
  if (!meta) {
    return {
      id: textId,
      displayName: textId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      category: 'Vedanta',
      originalScript: 'sa-Latn',
      fileName: `${textId}.xml`,
      candidateCount: 0,
    };
  }
  return meta;
}

/**
 * Get available text metadata for the source dropdown.
 */
export function getAvailableTexts(): WisdomTextMeta[] {
  const index = loadIndex();
  return index.texts;
}

/**
 * Get batch health status for monitoring.
 * Restores used IDs from DB if not done yet.
 */
export async function getBatchStatus(): Promise<BatchStatus> {
  await restoreUsedIdsFromDb();
  const batch = loadBatch();
  const total = batch.cards.length;
  const used = usedCardIdsRuntime.size;
  const remaining = total - used;

  return {
    total,
    used,
    remaining,
    needsRefresh: remaining <= REPLENISH_THRESHOLD,
  };
}

/**
 * Get the set of used card IDs.
 */
export function getUsedCardIds(): string[] {
  return Array.from(usedCardIdsRuntime);
}

/**
 * Invalidate cached data (after replenish).
 */
export function invalidateCache(): void {
  cachedBatch = null;
  cachedIndex = null;
  usedIdsRestoredFromDb = false;
}
