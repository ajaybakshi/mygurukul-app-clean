/**
 * ReAct Orchestrator — Sonnet-powered Multi-Step Search
 *
 * Implements a ReAct (Reason + Act) loop where Sonnet:
 * 1. Reasons about what to search for
 * 2. Calls tools (search, Amarakosha lookup, validate, etc.)
 * 3. Evaluates results and decides if more searching is needed
 * 4. Stops when it has 3-5 well-grounded passages
 *
 * IMPORTANT: Passages are collected directly from tool results
 * as they flow through the loop — we do NOT rely on the model's
 * final text output for structured data. This is more reliable
 * and eliminates the JSON parsing failure mode.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient, MODELS } from './client';
import { SACRED_SEARCH_TOOLS } from './tools';
import { executeTool } from './toolExecutor';
import type { QueryIntent } from './intentClassifier';
import type { ConceptExpansion } from '@/lib/services/amarakoshaService';

export interface OrchestratorResult {
  passages: PassageResult[];
  search_summary: string;
  tool_calls_made: number;
}

export interface PassageResult {
  chunk_id: number;
  text_id: string;
  title: string;
  category: string;
  section: string | null;
  verse_refs: string[];
  chunk_text: string;
  relevance_score: string;
}

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the search orchestrator for MyGurukul, a sacred Sanskrit wisdom platform.
Your role is to find the most relevant passages from a corpus of 33 core authentic
Sanskrit texts to answer a seeker's question.

THE CORPUS: Texts are in Sanskrit (IAST transliteration) from GRETIL and SARIT corpora.
Covering: Vedas, Upanishads, Epics (Mahabharata, Ramayana, Bhagavad Gita),
Puranas, Darshanas, Ayurveda (Ashtanga Hrdaya, Sushruta, Caraka Samhita), and more.

YOUR TOOLS:
- search_scriptures: Primary search (semantic + keyword). ALWAYS include sanskrit_terms when available.
- amarakosha_lookup: Expand concepts to Sanskrit synonyms. Use when results are sparse.
- search_by_text: Search within a specific text.
- read_passage: Get surrounding context for a found passage.
- validate_verse: Verify a verse reference exists.
- list_texts: Browse available texts.
- get_related_passages: Cross-reference across traditions.

YOUR APPROACH:
1. Start with search_scriptures using the English query AND the provided Sanskrit terms
2. If results are thin, use amarakosha_lookup then search again
3. For text-specific queries, use search_by_text
4. Stop when you have good results — be efficient with tool calls

RULES:
- ONLY use content from tool results. Never generate scripture from memory.
- Maximum 3 tool calls. Be efficient — one good search is better than many weak ones.
- After your searches, briefly summarize what you found and why it's relevant.`;

const MAX_TOOL_CALLS = 3;

/**
 * Run the orchestrator ReAct loop.
 * Passages are collected from tool results as they arrive —
 * we don't rely on the model's final text output for structured data.
 */
export async function runOrchestrator(
  question: string,
  intent: QueryIntent,
  amarakoshaExpansions: ConceptExpansion[]
): Promise<OrchestratorResult> {
  const client = getAnthropicClient();

  // Merge all Sanskrit terms from intent + Amarakosha
  const allSanskritTerms = new Set<string>(intent.suggested_sanskrit_terms);
  for (const exp of amarakoshaExpansions) {
    for (const term of exp.sanskrit_terms) {
      allSanskritTerms.add(term);
    }
  }

  const enrichedMessage = buildEnrichedQuery(
    question,
    intent,
    Array.from(allSanskritTerms),
    amarakoshaExpansions
  );

  // Accumulator: collect passages from tool results as they flow
  const collectedPassages = new Map<number, PassageResult>();
  let toolCallCount = 0;

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: enrichedMessage },
  ];

  for (let turn = 0; turn < MAX_TOOL_CALLS + 1; turn++) {
    const response = await client.messages.create({
      model: MODELS.ORCHESTRATOR,
      max_tokens: 2048,
      system: ORCHESTRATOR_SYSTEM_PROMPT,
      tools: SACRED_SEARCH_TOOLS,
      messages,
    });

    if (response.stop_reason === 'tool_use') {
      const assistantContent = response.content;
      messages.push({ role: 'assistant', content: assistantContent });

      // Execute all tool calls in this turn
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of assistantContent) {
        if (block.type === 'tool_use') {
          toolCallCount++;
          const resultStr = await executeTool(
            block.name,
            block.input as Record<string, unknown>
          );

          // Intercept: extract passages from search tool results
          const passages = extractPassagesFromToolResult(block.name, resultStr);
          for (const p of passages) {
            if (!collectedPassages.has(p.chunk_id)) {
              collectedPassages.set(p.chunk_id, p);
            }
          }
          console.log(`[Orchestrator] Tool ${toolCallCount}: ${block.name} → ${passages.length} passages (total unique: ${collectedPassages.size})`);

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: resultStr,
          });
        }
      }

      messages.push({ role: 'user', content: toolResults });

      // Early exit: if we already have 5+ unique passages, stop the loop
      if (collectedPassages.size >= 5) {
        break;
      }

      continue;
    }

    // Model is done (stop_reason === 'end_turn') — extract summary from final text
    const finalText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    return buildResult(collectedPassages, finalText, toolCallCount);
  }

  // Loop exhausted — return whatever we've collected
  return buildResult(
    collectedPassages,
    `Found ${collectedPassages.size} passages across ${toolCallCount} searches.`,
    toolCallCount
  );
}

/**
 * Extract passage data from tool result strings.
 * Only search-type tools (search_scriptures, search_by_text, get_related_passages)
 * return passage data we want to collect.
 */
function extractPassagesFromToolResult(
  toolName: string,
  resultStr: string
): PassageResult[] {
  const SEARCH_TOOLS = ['search_scriptures', 'search_by_text', 'get_related_passages'];
  if (!SEARCH_TOOLS.includes(toolName)) {
    return [];
  }

  try {
    const parsed = JSON.parse(resultStr);
    const results = parsed.results || parsed.related || [];

    return results
      .filter((r: Record<string, unknown>) => r.chunk_id && r.chunk_text)
      .map((r: Record<string, unknown>) => ({
        chunk_id: r.chunk_id as number,
        text_id: (r.text_id as string) || '',
        title: (r.title as string) || '',
        category: (r.category as string) || '',
        section: (r.section as string) || null,
        verse_refs: (r.verse_refs as string[]) || [],
        chunk_text: (r.chunk_text as string) || '',
        relevance_score: (r.relevance_score as string) || (r.similarity as string) || '0',
      }));
  } catch {
    return [];
  }
}

/**
 * Build the final OrchestratorResult from collected passages.
 * Sorts by relevance score and limits to top 5.
 */
function buildResult(
  collectedPassages: Map<number, PassageResult>,
  searchSummary: string,
  toolCallCount: number
): OrchestratorResult {
  const passages = Array.from(collectedPassages.values())
    .sort((a, b) => parseFloat(b.relevance_score) - parseFloat(a.relevance_score))
    .slice(0, 5);

  return {
    passages,
    search_summary: searchSummary.substring(0, 500),
    tool_calls_made: toolCallCount,
  };
}

/**
 * Build the enriched initial query message with all pre-expanded context.
 */
function buildEnrichedQuery(
  question: string,
  intent: QueryIntent,
  allSanskritTerms: string[],
  expansions: ConceptExpansion[]
): string {
  let msg = `SEEKER'S QUESTION: ${question}\n\n`;

  if (intent.detected_language !== 'en') {
    msg += `DETECTED LANGUAGE: ${intent.detected_language}\n`;
    msg += `ENGLISH TRANSLATION: ${intent.query_in_english}\n\n`;
  }

  msg += `QUERY TYPE: ${intent.query_type} | COMPLEXITY: ${intent.complexity}\n`;

  if (intent.key_concepts.length > 0) {
    msg += `KEY CONCEPTS: ${intent.key_concepts.join(', ')}\n`;
  }

  if (allSanskritTerms.length > 0) {
    msg += `PRE-EXPANDED SANSKRIT TERMS: ${allSanskritTerms.slice(0, 20).join(', ')}\n`;
  }

  if (expansions.length > 0) {
    msg += `\nAMARAKOSHA EXPANSIONS:\n`;
    for (const exp of expansions) {
      if (exp.sanskrit_terms.length > 0) {
        msg += `  ${exp.original_term} → ${exp.sanskrit_terms.slice(0, 8).join(', ')}\n`;
      }
    }
  }

  if (intent.target_texts.length > 0) {
    msg += `\nSPECIFIC TEXTS MENTIONED: ${intent.target_texts.join(', ')}\n`;
  }

  if (intent.target_categories.length > 0) {
    msg += `SUGGESTED CATEGORIES: ${intent.target_categories.join(', ')}\n`;
  }

  msg += `\nPlease search for the most relevant passages to answer this question. Use the Sanskrit terms provided to boost your keyword search.`;

  return msg;
}
