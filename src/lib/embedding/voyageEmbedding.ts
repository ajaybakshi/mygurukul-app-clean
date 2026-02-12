/**
 * Voyage AI Embedding Service
 *
 * Wraps the Voyage AI API for query-time and batch embedding.
 * Uses voyage-3 model (1024 dimensions, multilingual — handles IAST Sanskrit).
 *
 * Used at search time to embed the user's query for semantic search
 * against the pre-embedded scripture corpus.
 */

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3';
const EMBEDDING_DIMS = 1024;

/**
 * Embed a single query string for search.
 * Uses input_type='query' for asymmetric retrieval (corpus was embedded as 'document').
 */
export async function embedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error('VOYAGE_API_KEY not set');

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: [text],
      input_type: 'query',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage embedding error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Embed multiple texts in a single batch call.
 * Used for batch operations (not typical at query time).
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error('VOYAGE_API_KEY not set');

  const response = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      input_type: 'query',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage batch embedding error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.data
    .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
    .map((d: { embedding: number[] }) => d.embedding);
}

export { EMBEDDING_DIMS };
