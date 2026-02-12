/**
 * Tool Executor — Maps Claude Tool Calls to Database & Service Operations
 *
 * Each tool call from the orchestrator's ReAct loop is routed here.
 * This is the bridge between Claude's abstract tool invocations and
 * the actual hybrid search, Amarakosha lookups, and DB queries.
 */

import { embedQuery } from '@/lib/embedding/voyageEmbedding';
import * as repo from '@/lib/db/scriptureRepository';
import * as amarakosha from '@/lib/services/amarakoshaService';

interface ToolInput {
  [key: string]: unknown;
}

/**
 * Execute a tool call and return the result as a string.
 * The result is passed back to Claude as a tool_result message.
 */
export async function executeTool(
  toolName: string,
  input: ToolInput
): Promise<string> {
  switch (toolName) {
    case 'search_scriptures':
      return executeSearchScriptures(input);
    case 'amarakosha_lookup':
      return executeAmarakoshaLookup(input);
    case 'search_by_text':
      return executeSearchByText(input);
    case 'read_passage':
      return executeReadPassage(input);
    case 'validate_verse':
      return executeValidateVerse(input);
    case 'list_texts':
      return executeListTexts(input);
    case 'get_related_passages':
      return executeGetRelatedPassages(input);
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

async function executeSearchScriptures(input: ToolInput): Promise<string> {
  const query = input.query as string;
  const sanskritTerms = (input.sanskrit_terms as string[]) || [];
  const category = input.category as string | undefined;
  const limit = (input.limit as number) || 5;

  // Embed the query using Voyage (multilingual — handles English queries against Sanskrit corpus)
  const queryEmbedding = await embedQuery(query);

  const results = await repo.hybridSearch({
    query_embedding: queryEmbedding,
    sanskrit_terms: sanskritTerms,
    category,
    limit,
  });

  if (results.length === 0) {
    return JSON.stringify({
      message: 'No results found. Try using amarakosha_lookup to expand your Sanskrit terms, or broaden your category filter.',
      results: [],
    });
  }

  return JSON.stringify({
    total: results.length,
    results: results.map(r => ({
      chunk_id: r.id,
      text_id: r.text_id,
      title: r.title,
      category: r.category,
      section: r.section,
      verse_refs: r.verse_refs,
      chunk_text: r.chunk_text.substring(0, 1500), // Truncate for context window
      relevance_score: r.rrf_score.toFixed(4),
    })),
  });
}

async function executeAmarakoshaLookup(input: ToolInput): Promise<string> {
  const concept = input.concept as string;

  // Try English concept expansion first
  const expansion = await amarakosha.expandConcept(concept);

  if (expansion.sanskrit_terms.length > 0) {
    return JSON.stringify({
      concept,
      sanskrit_synonyms: expansion.sanskrit_terms,
      english_gloss: expansion.english_gloss,
      category: expansion.category,
      suggestion: `Use these terms in your search_scriptures call as sanskrit_terms: [${expansion.sanskrit_terms.slice(0, 8).map(t => `"${t}"`).join(', ')}]`,
    });
  }

  // Try reverse lookup (Sanskrit → English)
  const reverse = await amarakosha.lookupSanskritTerm(concept);
  if (reverse) {
    return JSON.stringify({
      concept,
      sanskrit_synonyms: reverse.sanskrit_terms,
      english_gloss: reverse.english_gloss,
      category: reverse.category,
    });
  }

  return JSON.stringify({
    concept,
    sanskrit_synonyms: [],
    message: `No Amarakosha entry found for "${concept}". Try a broader English term or a well-known Sanskrit term.`,
  });
}

async function executeSearchByText(input: ToolInput): Promise<string> {
  const textName = input.text_name as string;
  const query = input.query as string;
  const sanskritTerms = (input.sanskrit_terms as string[]) || [];
  const limit = (input.limit as number) || 5;

  const queryEmbedding = await embedQuery(query);

  const results = await repo.searchByText(
    textName,
    queryEmbedding,
    sanskritTerms,
    limit
  );

  if (results.length === 0) {
    return JSON.stringify({
      message: `No results found in "${textName}". The text may not be in the corpus, or the query didn't match. Use list_texts to see available texts.`,
      results: [],
    });
  }

  return JSON.stringify({
    text: textName,
    total: results.length,
    results: results.map(r => ({
      chunk_id: r.id,
      text_id: r.text_id,
      title: r.title,
      category: r.category,
      section: r.section,
      verse_refs: r.verse_refs,
      chunk_text: r.chunk_text.substring(0, 1500),
      relevance_score: r.rrf_score.toFixed(4),
    })),
  });
}

async function executeReadPassage(input: ToolInput): Promise<string> {
  const chunkId = input.chunk_id as number;
  const contextSize = (input.context_size as number) || 2;

  try {
    const { center, context } = await repo.getChunkContext(chunkId, contextSize);

    return JSON.stringify({
      center: {
        chunk_id: center.id,
        text_id: center.text_id,
        title: center.title,
        section: center.section,
        verse_refs: center.verse_refs,
        chunk_text: center.chunk_text,
      },
      surrounding_context: context.map(c => ({
        chunk_id: c.id,
        chunk_index: c.chunk_index,
        verse_refs: c.verse_refs,
        chunk_text: c.chunk_text.substring(0, 1000),
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return JSON.stringify({ error: message });
  }
}

async function executeValidateVerse(input: ToolInput): Promise<string> {
  const reference = input.reference as string;

  const result = await repo.validateVerse(reference);

  if (result) {
    return JSON.stringify({
      valid: true,
      reference,
      text_id: result.text_id,
      verse_text: result.verse_text.substring(0, 500),
    });
  }

  return JSON.stringify({
    valid: false,
    reference,
    message: `Verse "${reference}" not found in the corpus. Do NOT cite this reference.`,
  });
}

async function executeListTexts(input: ToolInput): Promise<string> {
  const category = input.category as string | undefined;

  const texts = await repo.listTexts(category);

  return JSON.stringify({
    category: category || 'all',
    total: texts.length,
    texts: texts.map(t => ({
      text_id: t.text_id,
      title: t.title,
      category: t.category,
      chunks: t.total_chunks,
    })),
  });
}

async function executeGetRelatedPassages(input: ToolInput): Promise<string> {
  const chunkId = input.chunk_id as number;
  const limit = (input.limit as number) || 3;

  const results = await repo.getRelatedPassages(chunkId, limit);

  if (results.length === 0) {
    return JSON.stringify({
      message: 'No related passages found from other texts.',
      results: [],
    });
  }

  return JSON.stringify({
    source_chunk_id: chunkId,
    related: results.map(r => ({
      chunk_id: r.id,
      text_id: r.text_id,
      title: r.title,
      category: r.category,
      section: r.section,
      verse_refs: r.verse_refs,
      chunk_text: r.chunk_text.substring(0, 1000),
      similarity: r.rrf_score.toFixed(4),
    })),
  });
}
