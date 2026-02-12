/**
 * Intent Classifier — Haiku-powered Query Understanding
 *
 * This is the "language bridge" entry point. Haiku does three things in one call:
 * 1. Detects language and translates to English if needed
 * 2. Classifies query type and complexity
 * 3. Extracts key concepts and suggests Sanskrit terms
 *
 * After Haiku returns, the system augments its suggestions with
 * Amarakosha synonyms for comprehensive Sanskrit term coverage.
 */

import { getAnthropicClient, MODELS } from './client';

export interface QueryIntent {
  query_type:
    | 'verse_lookup'
    | 'philosophical_guidance'
    | 'concept_explanation'
    | 'practice_advice'
    | 'comparative'
    | 'life_guidance'
    | 'text_exploration';
  complexity: 'simple' | 'medium' | 'complex';
  detected_language: string;
  query_in_english: string;
  key_concepts: string[];
  target_texts: string[];
  target_categories: string[];
  suggested_sanskrit_terms: string[];
  requires_cross_reference: boolean;
}

const CLASSIFIER_SYSTEM_PROMPT = `You are a query classifier for MyGurukul, a Sanskrit spiritual wisdom platform.

Given a seeker's question (in any language), you must:
1. Detect the language
2. If not English, provide an English translation
3. Classify the query type and complexity
4. Extract key spiritual/philosophical concepts
5. Suggest Sanskrit terms that correspond to those concepts
6. Identify any specific texts or traditions mentioned

QUERY TYPES:
- verse_lookup: Asking about a specific verse or passage
- philosophical_guidance: Seeking understanding of philosophical concepts
- concept_explanation: Asking what a term/concept means
- practice_advice: How to practice (meditation, yoga, rituals, etc.)
- comparative: Comparing across texts or traditions
- life_guidance: Personal life questions seeking scriptural wisdom
- text_exploration: Browsing or exploring a specific text

COMPLEXITY:
- simple: Single concept, specific text, clear answer exists
- medium: Multi-concept, may need 2-3 sources
- complex: Cross-tradition comparison, nuanced philosophical question, needs synthesis

CONCEPT → SANSKRIT MAPPING (use your knowledge):
- fear/anxiety → bhaya, trāsa, udvega, cintā
- courage/fearlessness → abhaya, śaurya, dhairya, vīrya
- duty → dharma, kartavya, svadharma
- soul/self → ātman, jīva, puruṣa
- liberation → mokṣa, mukti, kaivalya, nirvāṇa
- meditation → dhyāna, yoga, samādhi, dhāraṇā
- truth → satya, ṛta, tattva
- knowledge → jñāna, vidyā, prajñā
- devotion → bhakti, śraddhā, upāsanā
- action → karma, kriyā, ceṣṭā
- peace → śānti, praśānti, upaśama
- compassion → karuṇā, dayā, kṛpā, anukampā
- ego → ahaṅkāra, abhimāna, garva
- detachment → vairāgya, tyāga, nivṛtti
- consciousness → cit, cetanā, caitanya, vijñāna
(and many more — use your full Sanskrit knowledge)

Return ONLY valid JSON matching this exact schema:
{
  "query_type": "...",
  "complexity": "...",
  "detected_language": "en",
  "query_in_english": "...",
  "key_concepts": ["concept1", "concept2"],
  "target_texts": [],
  "target_categories": [],
  "suggested_sanskrit_terms": ["term1", "term2"],
  "requires_cross_reference": false
}`;

/**
 * Classify a user query using Haiku.
 * Fast (~1-2s) and cheap (~$0.001/call).
 */
export async function classifyIntent(question: string): Promise<QueryIntent> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: MODELS.CLASSIFIER,
    max_tokens: 512,
    system: CLASSIFIER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: question }],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    // Extract JSON from response (Haiku might wrap it in markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    return JSON.parse(jsonMatch[0]) as QueryIntent;
  } catch {
    // Fallback: return a sensible default
    return {
      query_type: 'life_guidance',
      complexity: 'medium',
      detected_language: 'en',
      query_in_english: question,
      key_concepts: [],
      target_texts: [],
      target_categories: [],
      suggested_sanskrit_terms: [],
      requires_cross_reference: false,
    };
  }
}
