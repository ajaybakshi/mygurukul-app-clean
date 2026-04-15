/**
 * Scripture Repository — Hybrid Search & Data Access
 *
 * Provides triple-hybrid search over the scripture corpus:
 * 1. Semantic search (Voyage embeddings via pgvector cosine distance)
 * 2. Keyword search (tsvector full-text search against IAST Sanskrit)
 * 3. Amarakosha term matching (array overlap on key_terms)
 *
 * Results are fused using Reciprocal Rank Fusion (RRF) — a proven
 * technique that combines ranked lists without needing score calibration.
 * RRF formula: score = Σ (1 / (k + rank_i)) for each signal i
 */

import { sql } from '@/lib/db';

export interface SearchResult {
  id: number;
  text_id: string;
  chunk_index: number;
  chunk_text: string;
  chunk_text_summary: string | null;
  verse_refs: string[];
  section: string | null;
  title: string;
  category: string;
  rrf_score: number;
}

export interface SearchOptions {
  query_embedding: number[];
  sanskrit_terms?: string[];
  category?: string;
  text_id?: string;
  limit?: number;
}

/**
 * Triple-hybrid search using Reciprocal Rank Fusion.
 *
 * Weights: semantic (1.0) + keyword (0.8) + term overlap (0.6)
 * RRF constant k=60 (standard value from the original paper).
 */
export async function hybridSearch(options: SearchOptions): Promise<SearchResult[]> {
  const {
    query_embedding,
    sanskrit_terms = [],
    category,
    text_id,
    limit = 5,
  } = options;

  const embeddingStr = `[${query_embedding.join(',')}]`;
  // Build Sanskrit keyword string for tsvector search
  const keywordStr = sanskrit_terms.join(' ');

  const result = await sql.query(
    `
    WITH semantic AS (
      SELECT c.id, c.text_id, c.chunk_index, c.chunk_text, c.chunk_text_summary,
             c.verse_refs, c.section,
             ROW_NUMBER() OVER (ORDER BY c.embedding <=> $1::halfvec(1024)) AS rank
      FROM scripture_chunks c
      JOIN scripture_texts t ON t.text_id = c.text_id
      WHERE ($2::text IS NULL OR c.text_id = $2)
        AND ($3::text IS NULL OR t.category = $3)
      ORDER BY c.embedding <=> $1::halfvec(1024)
      LIMIT 30
    ),
    keyword AS (
      SELECT c.id,
             ROW_NUMBER() OVER (ORDER BY ts_rank(c.search_text, plainto_tsquery('simple', $4)) DESC) AS rank
      FROM scripture_chunks c
      JOIN scripture_texts t ON t.text_id = c.text_id
      WHERE $4 != ''
        AND c.search_text @@ plainto_tsquery('simple', $4)
        AND ($2::text IS NULL OR c.text_id = $2)
        AND ($3::text IS NULL OR t.category = $3)
      LIMIT 30
    ),
    term_match AS (
      SELECT c.id,
             ROW_NUMBER() OVER (ORDER BY array_length(
               ARRAY(SELECT unnest(c.key_terms) INTERSECT SELECT unnest($5::text[])), 1
             ) DESC NULLS LAST) AS rank
      FROM scripture_chunks c
      JOIN scripture_texts t ON t.text_id = c.text_id
      WHERE cardinality($5::text[]) > 0
        AND c.key_terms && $5::text[]
        AND ($2::text IS NULL OR c.text_id = $2)
        AND ($3::text IS NULL OR t.category = $3)
      LIMIT 30
    )
    SELECT
      s.id, s.text_id, s.chunk_index, s.chunk_text, s.chunk_text_summary,
      s.verse_refs, s.section,
      t.title, t.category,
      (
        COALESCE(1.0 / (60 + s.rank), 0) * 1.0 +
        COALESCE(1.0 / (60 + k.rank), 0) * 0.8 +
        COALESCE(1.0 / (60 + tm.rank), 0) * 0.6
      ) AS rrf_score
    FROM semantic s
    LEFT JOIN keyword k ON s.id = k.id
    LEFT JOIN term_match tm ON s.id = tm.id
    JOIN scripture_texts t ON t.text_id = s.text_id
    ORDER BY rrf_score DESC
    LIMIT $6
    `,
    [embeddingStr, text_id || null, category || null, keywordStr, sanskrit_terms, limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    text_id: row.text_id,
    chunk_index: row.chunk_index,
    chunk_text: row.chunk_text,
    chunk_text_summary: row.chunk_text_summary,
    verse_refs: row.verse_refs || [],
    section: row.section,
    title: row.title,
    category: row.category,
    rrf_score: parseFloat(row.rrf_score),
  }));
}

/**
 * Search within a specific scripture by name.
 * Resolves text name to text_id first, then runs hybrid search.
 */
export async function searchByText(
  textName: string,
  queryEmbedding: number[],
  sanskritTerms: string[] = [],
  limit = 5
): Promise<SearchResult[]> {
  // Resolve text name to text_id (fuzzy match on title)
  const textResult = await sql`
    SELECT text_id FROM scripture_texts
    WHERE LOWER(title) LIKE ${`%${textName.toLowerCase()}%`}
    LIMIT 1
  `;

  if (textResult.rows.length === 0) {
    // Try matching on text_id directly
    const idResult = await sql`
      SELECT text_id FROM scripture_texts
      WHERE LOWER(text_id) LIKE ${`%${textName.toLowerCase().replace(/\s+/g, '')}%`}
      LIMIT 1
    `;
    if (idResult.rows.length === 0) return [];
    return hybridSearch({
      query_embedding: queryEmbedding,
      text_id: idResult.rows[0].text_id,
      sanskrit_terms: sanskritTerms,
      limit,
    });
  }

  return hybridSearch({
    query_embedding: queryEmbedding,
    text_id: textResult.rows[0].text_id,
    sanskrit_terms: sanskritTerms,
    limit,
  });
}

/**
 * Get surrounding context for a chunk (chunks before and after).
 */
export async function getChunkContext(
  chunkId: number,
  contextSize = 2
): Promise<{ center: SearchResult; context: SearchResult[] }> {
  // Get the target chunk
  const center = await sql.query(
    `SELECT c.id, c.text_id, c.chunk_index, c.chunk_text, c.chunk_text_summary,
            c.verse_refs, c.section, t.title, t.category
     FROM scripture_chunks c
     JOIN scripture_texts t ON t.text_id = c.text_id
     WHERE c.id = $1`,
    [chunkId]
  );

  if (center.rows.length === 0) {
    throw new Error(`Chunk ${chunkId} not found`);
  }

  const row = center.rows[0];

  // Get surrounding chunks
  const context = await sql.query(
    `SELECT c.id, c.text_id, c.chunk_index, c.chunk_text, c.chunk_text_summary,
            c.verse_refs, c.section, t.title, t.category
     FROM scripture_chunks c
     JOIN scripture_texts t ON t.text_id = c.text_id
     WHERE c.text_id = $1
       AND c.chunk_index BETWEEN $2 AND $3
       AND c.id != $4
     ORDER BY c.chunk_index`,
    [row.text_id, row.chunk_index - contextSize, row.chunk_index + contextSize, chunkId]
  );

  const mapRow = (r: any): SearchResult => ({
    id: r.id,
    text_id: r.text_id,
    chunk_index: r.chunk_index,
    chunk_text: r.chunk_text,
    chunk_text_summary: r.chunk_text_summary,
    verse_refs: r.verse_refs || [],
    section: r.section,
    title: r.title,
    category: r.category,
    rrf_score: 0,
  });

  return {
    center: mapRow(row),
    context: context.rows.map(mapRow),
  };
}

/**
 * Validate a verse reference against the verse_index.
 * Returns the canonical verse text if found, null otherwise.
 *
 * Note: verse_index is not yet populated in the current pipeline.
 * Falls back to searching chunk verse_refs.
 */
export async function validateVerse(
  reference: string
): Promise<{ text_id: string; reference: string; verse_text: string } | null> {
  // Try verse_index first
  const indexResult = await sql.query(
    `SELECT text_id, reference, verse_text
     FROM verse_index
     WHERE reference = $1
     LIMIT 1`,
    [reference]
  );

  if (indexResult.rows.length > 0) {
    return indexResult.rows[0];
  }

  // Fallback: search chunk verse_refs arrays
  const chunkResult = await sql.query(
    `SELECT c.text_id, c.chunk_text, c.verse_refs, t.title
     FROM scripture_chunks c
     JOIN scripture_texts t ON t.text_id = c.text_id
     WHERE $1 = ANY(c.verse_refs)
     LIMIT 1`,
    [reference]
  );

  if (chunkResult.rows.length > 0) {
    return {
      text_id: chunkResult.rows[0].text_id,
      reference,
      verse_text: chunkResult.rows[0].chunk_text.substring(0, 500),
    };
  }

  return null;
}

/**
 * List available texts, optionally filtered by category.
 */
export async function listTexts(
  category?: string
): Promise<Array<{ text_id: string; title: string; category: string; total_chunks: number }>> {
  const result = category
    ? await sql`
        SELECT text_id, title, category, total_chunks
        FROM scripture_texts
        WHERE category = ${category}
        ORDER BY title`
    : await sql`
        SELECT text_id, title, category, total_chunks
        FROM scripture_texts
        ORDER BY category, title`;

  return result.rows as Array<{ text_id: string; title: string; category: string; total_chunks: number }>;
}

/**
 * Find thematically related passages by embedding similarity.
 */
export async function getRelatedPassages(
  chunkId: number,
  limit = 3
): Promise<SearchResult[]> {
  const result = await sql.query(
    `SELECT c2.id, c2.text_id, c2.chunk_index, c2.chunk_text, c2.chunk_text_summary,
            c2.verse_refs, c2.section, t.title, t.category,
            1 - (c2.embedding <=> c1.embedding) AS similarity
     FROM scripture_chunks c1
     JOIN scripture_chunks c2 ON c2.text_id != c1.text_id
     JOIN scripture_texts t ON t.text_id = c2.text_id
     WHERE c1.id = $1
     ORDER BY c2.embedding <=> c1.embedding
     LIMIT $2`,
    [chunkId, limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    text_id: row.text_id,
    chunk_index: row.chunk_index,
    chunk_text: row.chunk_text,
    chunk_text_summary: row.chunk_text_summary,
    verse_refs: row.verse_refs || [],
    section: row.section,
    title: row.title,
    category: row.category,
    rrf_score: parseFloat(row.similarity),
  }));
}
