/**
 * Anthropic Client & Model Configuration
 *
 * Multi-model strategy:
 * - Haiku: Intent classification + concept extraction (~$0.001/query)
 * - Sonnet: Search orchestration ReAct loop (~$0.02-0.05/query)
 * - Opus: Complex synthesis for deep philosophical questions (~$0.01-0.03/query)
 */

import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export const MODELS = {
  CLASSIFIER: 'claude-haiku-4-5-20251001' as const,
  ORCHESTRATOR: 'claude-sonnet-4-5-20250929' as const,
  SYNTHESIZER: 'claude-sonnet-4-5-20250929' as const, // Use Sonnet by default, Opus for complex
  SYNTHESIZER_COMPLEX: 'claude-opus-4-6' as const,
};

export type ModelComplexity = 'simple' | 'medium' | 'complex';

/**
 * Select the synthesis model based on query complexity.
 * Simple/medium → Sonnet (fast, cheap), complex → Opus (deep, thorough).
 */
export function selectSynthesisModel(complexity: ModelComplexity): string {
  return complexity === 'complex' ? MODELS.SYNTHESIZER_COMPLEX : MODELS.SYNTHESIZER;
}
