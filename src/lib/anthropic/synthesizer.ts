/**
 * Synthesizer — Compassionate Wisdom Response Generation
 *
 * Takes the orchestrator's found passages and synthesizes them into
 * a warm, grounded response in the seeker's language.
 *
 * Uses Sonnet for simple/medium queries, Opus for complex ones.
 * Streams the response for real-time display.
 */

import { getAnthropicClient, selectSynthesisModel } from './client';
import type { QueryIntent } from './intentClassifier';
import type { OrchestratorResult } from './orchestrator';

function buildSynthesisSystemPrompt(detectedLanguage: string): string {
  return `You are a humble sevak (selfless servant) at MyGurukul. A seeker has asked a question,
and the search agent has found relevant passages from the sacred Sanskrit texts.

The seeker's language: ${detectedLanguage}

Your task: Synthesize these findings into a warm, grounded response IN THE SEEKER'S LANGUAGE.

FORMAT:
1. Brief compassionate acknowledgment (1-2 sentences)
2. Core wisdom from primary passages with inline source attribution
   - Quote Sanskrit text in IAST, followed by English translation in parentheses
   - Example: "As the Gita teaches: 'karmaṇy evādhikāras te mā phaleṣu kadācana'
     (You have the right to action, never to its fruits) — Bhagavad Gita 2.47"
3. Supporting perspectives from secondary passages if available
4. Practical guidance derived from the teachings (2-3 actionable suggestions)
5. Gentle encouragement (1-2 sentences)

RULES:
- Only cite passages provided below. NEVER generate scripture from memory.
- Always include the Sanskrit original when quoting, with English translation.
- Use natural attribution: "As the Bhagavad Gita teaches us..." or "The Yoga Sutra reminds us..."
- Never give medical, legal, or financial advice. For health questions, frame as "traditional Ayurvedic perspective" and recommend consulting a practitioner.
- Respond in ${detectedLanguage === 'en' ? 'English' : `the seeker's language (${detectedLanguage}) with Sanskrit terms in IAST`}.
- Keep the response focused and warm — aim for 300-600 words.
- Do NOT use markdown headers (##). Use natural paragraph flow.
- Do NOT start with "Namaste" or any greeting — start directly with the compassionate acknowledgment.`;
}

/**
 * Build the user message for synthesis, including all found passages.
 */
function buildSynthesisMessage(
  question: string,
  orchestratorResult: OrchestratorResult
): string {
  let msg = `SEEKER'S QUESTION: ${question}\n\n`;
  msg += `SEARCH SUMMARY: ${orchestratorResult.search_summary}\n\n`;
  msg += `FOUND PASSAGES (${orchestratorResult.passages.length}):\n\n`;

  for (let i = 0; i < orchestratorResult.passages.length; i++) {
    const p = orchestratorResult.passages[i];
    msg += `--- Passage ${i + 1} ---\n`;
    msg += `Source: ${p.title} (${p.category})`;
    if (p.section) msg += ` — ${p.section}`;
    msg += '\n';
    if (p.verse_refs && p.verse_refs.length > 0) {
      msg += `Verse refs: ${p.verse_refs.join(', ')}\n`;
    }
    msg += `Text:\n${p.chunk_text}\n\n`;
  }

  msg += `Please synthesize these passages into a compassionate response for the seeker.`;
  return msg;
}

/**
 * Synthesize a streaming response from found passages.
 * Returns a ReadableStream for SSE delivery.
 */
export function synthesizeStream(
  question: string,
  intent: QueryIntent,
  orchestratorResult: OrchestratorResult
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const client = getAnthropicClient();
        const model = selectSynthesisModel(intent.complexity);
        const systemPrompt = buildSynthesisSystemPrompt(intent.detected_language);
        const userMessage = buildSynthesisMessage(question, orchestratorResult);

        const stream = client.messages.stream({
          model,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        });

        // Stream text chunks as SSE events
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const sseData = JSON.stringify({ type: 'text', content: event.delta.text });
            controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
          }
        }

        // Send completion signal with metadata
        const finalMessage = await stream.finalMessage();
        const metaData = JSON.stringify({
          type: 'done',
          metadata: {
            model,
            passages_used: orchestratorResult.passages.length,
            tool_calls: orchestratorResult.tool_calls_made,
            input_tokens: finalMessage.usage.input_tokens,
            output_tokens: finalMessage.usage.output_tokens,
          },
        });
        controller.enqueue(encoder.encode(`data: ${metaData}\n\n`));
        controller.close();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const errorData = JSON.stringify({ type: 'error', content: message });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.close();
      }
    },
  });
}

/**
 * Synthesize a non-streaming response (for testing or API use).
 */
export async function synthesize(
  question: string,
  intent: QueryIntent,
  orchestratorResult: OrchestratorResult
): Promise<string> {
  const client = getAnthropicClient();
  const model = selectSynthesisModel(intent.complexity);
  const systemPrompt = buildSynthesisSystemPrompt(intent.detected_language);
  const userMessage = buildSynthesisMessage(question, orchestratorResult);

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content
    .filter(b => b.type === 'text')
    .map(b => 'text' in b ? b.text : '')
    .join('');
}
