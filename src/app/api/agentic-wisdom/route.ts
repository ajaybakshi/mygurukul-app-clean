/**
 * Agentic Sacred Wisdom API Route
 *
 * 4-stage pipeline:
 * 1. [Haiku] Intent classification + concept extraction (~1-2s)
 * 2. [Amarakosha] Concept → Sanskrit term expansion (<100ms)
 * 3. [Sonnet] ReAct orchestrator with 7 tools (~10-20s)
 * 4. [Sonnet/Opus] Streaming synthesis (~5-10s)
 *
 * Total: ~15-30s, well within Vercel's 60s hobby timeout.
 * Cost per query: ~$0.02-0.08
 *
 * Feature flag: NEXT_PUBLIC_AGENTIC_SEARCH=true
 */

import { NextRequest } from 'next/server';
import { classifyIntent } from '@/lib/anthropic/intentClassifier';
import { runOrchestrator } from '@/lib/anthropic/orchestrator';
import { synthesizeStream, synthesize } from '@/lib/anthropic/synthesizer';
import { expandConcepts } from '@/lib/services/amarakoshaService';
import { logConversation } from '@/lib/db/conversationRepository';
import { logApiMetric } from '@/lib/db/metricsRepository';

export type ConversationEntry = { sender: 'user' | 'ai'; text: string };

export const maxDuration = 60; // Vercel Hobby plan

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let question = '';
  let sessionId: string | undefined;

  try {
    const body = await req.json();
    question = body.question;
    sessionId = body.sessionId;
    const useStreaming = body.stream ?? true;
    const conversationHistory: ConversationEntry[] | undefined = body.conversationHistory;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Question is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[AgenticWisdom] Processing:', question.substring(0, 100));
    if (conversationHistory?.length) {
      console.log('[AgenticWisdom] Conversation history:', conversationHistory.length, 'messages');
    }

    // ═══════════════════════════════════════════════
    // Stage 1: Classify intent + extract concepts [Haiku, ~1-2s]
    // ═══════════════════════════════════════════════
    console.log('[AgenticWisdom] Stage 1: Intent classification...');
    const intent = await classifyIntent(question, conversationHistory);
    console.log('[AgenticWisdom] Intent:', {
      type: intent.query_type,
      complexity: intent.complexity,
      language: intent.detected_language,
      concepts: intent.key_concepts,
      sanskritTerms: intent.suggested_sanskrit_terms.length,
    });

    // ═══════════════════════════════════════════════
    // Stage 2: Expand concepts via Amarakosha [DB lookup, <100ms]
    // ═══════════════════════════════════════════════
    console.log('[AgenticWisdom] Stage 2: Amarakosha expansion...');
    const amarakoshaExpansions = await expandConcepts(intent.key_concepts);
    const expansionCount = amarakoshaExpansions.reduce(
      (sum, exp) => sum + exp.sanskrit_terms.length, 0
    );
    console.log('[AgenticWisdom] Amarakosha:', expansionCount, 'Sanskrit terms from', intent.key_concepts.length, 'concepts');

    // ═══════════════════════════════════════════════
    // Stage 3: Orchestrate search [Sonnet, ~10-20s]
    // ═══════════════════════════════════════════════
    console.log('[AgenticWisdom] Stage 3: Search orchestration...');
    const searchResult = await runOrchestrator(
      question,
      intent,
      amarakoshaExpansions
    );
    console.log('[AgenticWisdom] Search complete:', {
      passages: searchResult.passages.length,
      toolCalls: searchResult.tool_calls_made,
    });

    // ═══════════════════════════════════════════════
    // Stage 4: Synthesize response [Sonnet/Opus, ~5-10s]
    // ═══════════════════════════════════════════════
    console.log('[AgenticWisdom] Stage 4: Synthesis...');

    // Helper: build citations array for logging
    const buildLogCitations = () =>
      searchResult.passages.map(p => ({
        source: p.title,
        text: p.chunk_text.substring(0, 300),
        chapter: p.section || undefined,
        verse: p.verse_refs?.join(', ') || undefined,
      }));

    if (useStreaming) {
      // Streaming response (SSE) — sends status updates + synthesized text
      const encoder = new TextEncoder();
      const streamSessionId = sessionId || `agentic-${Date.now()}`;
      const stream = new ReadableStream({
        async start(controller) {
          // Send intent metadata as first event
          const metaEvent = JSON.stringify({
            type: 'status',
            content: `Synthesizing wisdom from ${searchResult.passages.length} passages...`,
          });
          controller.enqueue(encoder.encode(`data: ${metaEvent}\n\n`));

          // Pipe the synthesis stream
          const synthesisStream = synthesizeStream(question, intent, searchResult, conversationHistory);
          const reader = synthesisStream.getReader();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }

          // Persist conversation + metrics BEFORE closing the stream. On
          // Vercel the serverless instance can be frozen the moment the
          // response stream closes, so an un-awaited write here gets killed
          // before it lands — which silently dropped recent conversations
          // from the admin dashboard. Awaiting keeps the function alive until
          // the INSERT completes; the user already has all streamed content,
          // so this only delays the stream's "done" signal by a few ms.
          const elapsed = Date.now() - startTime;
          await Promise.all([
            logConversation({
              session_id: streamSessionId,
              question,
              response_narrative: `[streamed response - ${searchResult.passages.length} passages]`,
              citations: buildLogCitations(),
              provider: 'agentic-search',
              response_time_ms: elapsed,
              grounded: searchResult.passages.length > 0,
            }),
            logApiMetric({
              endpoint: '/api/agentic-wisdom',
              session_id: streamSessionId,
              latency_ms: elapsed,
              status_code: 200,
              success: true,
              request_metadata: {
                provider_used: 'agentic-search',
                query_length: question.length,
                streaming: true,
                passages_found: searchResult.passages.length,
                conversation_history_length: conversationHistory?.length ?? 0,
              },
            }),
          ]).catch(err => console.error('[AgenticWisdom] DB logging failed (non-fatal):', err));

          controller.close();
        },
      });

      const elapsed = Date.now() - startTime;
      console.log(`[AgenticWisdom] Streaming started after ${elapsed}ms`);

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } else {
      // Non-streaming response (for testing / API consumers)
      const responseText = await synthesize(question, intent, searchResult, conversationHistory);
      const elapsed = Date.now() - startTime;
      const resolvedSessionId = sessionId || `agentic-${Date.now()}`;
      console.log(`[AgenticWisdom] Complete in ${elapsed}ms`);

      // Persist conversation + metrics before returning, so the serverless
      // instance isn't frozen mid-write (see streaming branch above).
      await Promise.all([
        logConversation({
          session_id: resolvedSessionId,
          question,
          response_narrative: responseText,
          citations: buildLogCitations(),
          provider: 'agentic-search',
          response_time_ms: elapsed,
          grounded: searchResult.passages.length > 0,
        }),
        logApiMetric({
          endpoint: '/api/agentic-wisdom',
          session_id: resolvedSessionId,
          latency_ms: elapsed,
          status_code: 200,
          success: true,
          request_metadata: {
            provider_used: 'agentic-search',
            query_length: question.length,
            streaming: false,
            passages_found: searchResult.passages.length,
            conversation_history_length: conversationHistory?.length ?? 0,
          },
        }),
      ]).catch(err => console.error('[AgenticWisdom] DB logging failed (non-fatal):', err));

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            sessionId: resolvedSessionId,
            narrative: responseText,
            citations: searchResult.passages.map(p => ({
              source: p.text_id,
              title: p.title,
              text: p.chunk_text.substring(0, 300),
              verse_refs: p.verse_refs,
              section: p.section,
              category: p.category,
            })),
            metadata: {
              intent: {
                type: intent.query_type,
                complexity: intent.complexity,
                language: intent.detected_language,
                concepts: intent.key_concepts,
              },
              search: {
                passages_found: searchResult.passages.length,
                tool_calls: searchResult.tool_calls_made,
                summary: searchResult.search_summary,
              },
              timing: { total_ms: elapsed },
            },
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error('[AgenticWisdom] Pipeline error:', error);

    // Await so the error metric persists before the instance is frozen.
    await logApiMetric({
      endpoint: '/api/agentic-wisdom',
      session_id: sessionId,
      latency_ms: elapsed,
      status_code: 500,
      success: false,
      error_message: error instanceof Error ? error.message : 'Unknown error',
      request_metadata: {
        provider_used: 'agentic-search',
        query_length: question?.length || 0,
      },
    }).catch(err => console.error('[AgenticWisdom] Error logging failed:', err));

    return new Response(
      JSON.stringify({
        error: 'Failed to process your question. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
