/**
 * Tool Definitions for the Agentic Search Orchestrator
 *
 * 7 tools that Sonnet can call during its ReAct search loop:
 * 1. search_scriptures — triple-hybrid search
 * 2. amarakosha_lookup — concept → Sanskrit synonym expansion
 * 3. search_by_text — search within a specific scripture
 * 4. read_passage — expand context around a found passage
 * 5. validate_verse — anti-hallucination verse reference check
 * 6. list_texts — browse available scriptures
 * 7. get_related_passages — cross-tradition links
 */

import Anthropic from '@anthropic-ai/sdk';

export const SACRED_SEARCH_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_scriptures',
    description: `Search the sacred scripture corpus for relevant passages.
Performs triple hybrid search (semantic + Sanskrit keyword + Amarakosha term matching)
across 33 authentic Sanskrit texts from GRETIL and SARIT corpora including the Vedas,
Upanishads, Bhagavad Gita, Ramayana, Mahabharata, Puranas, Darshanas, and Ayurveda texts.
The corpus is in Sanskrit (IAST transliteration). Your query can be in English —
the system handles the translation via Voyage multilingual embeddings.
Filter by category: vedas, upanishads, epics, puranas, darshanas, sastras.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (English or Sanskrit)',
        },
        sanskrit_terms: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Sanskrit terms to boost keyword matching (e.g., ["dharma", "karma"]). ALWAYS include these when available — they dramatically improve results.',
        },
        category: {
          type: 'string',
          enum: [
            'vedas',
            'upanishads',
            'epics',
            'puranas',
            'darshanas',
            'sastras',
          ],
          description: 'Filter by scripture category. Omit to search all.',
        },
        limit: {
          type: 'integer',
          description: 'Max results (default 5)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'amarakosha_lookup',
    description: `Look up a concept in the Amarakosha, the ancient Sanskrit thesaurus (4th century CE).
Given an English concept or a Sanskrit term, returns ALL known Sanskrit synonyms.
Use this when your initial search results are sparse or you want to broaden your search.
Example: "vishnu" → 46 names, "heaven" → svarga, nāka, tridiva, "fear" → bhaya, trāsa, bhīti.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        concept: {
          type: 'string',
          description:
            'English concept or Sanskrit term to look up (e.g., "compassion", "dharma", "vishnu")',
        },
      },
      required: ['concept'],
    },
  },
  {
    name: 'search_by_text',
    description: `Search within a specific scripture by name.
Use when the seeker asks about a particular text (e.g., "What does the Gita say about...").`,
    input_schema: {
      type: 'object' as const,
      properties: {
        text_name: {
          type: 'string',
          description:
            'Scripture name (e.g., "Bhagavad Gita", "Ramayana", "Yoga Sutra")',
        },
        query: { type: 'string', description: 'Search query' },
        sanskrit_terms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Sanskrit terms to boost matching',
        },
        limit: { type: 'integer', description: 'Max results (default 5)' },
      },
      required: ['text_name', 'query'],
    },
  },
  {
    name: 'read_passage',
    description: `Read full context around a found passage (chunks before and after).
Use when you need more context to understand a passage you found via search.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        chunk_id: {
          type: 'integer',
          description: 'ID of the chunk to expand context for',
        },
        context_size: {
          type: 'integer',
          description:
            'Number of surrounding chunks to include (default 2, each direction)',
        },
      },
      required: ['chunk_id'],
    },
  },
  {
    name: 'validate_verse',
    description: `Verify a verse reference exists in the corpus.
ALWAYS use this before citing a specific verse reference to prevent hallucination.
Returns the verse text if found, null if not.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        reference: {
          type: 'string',
          description: 'Verse reference (e.g., "BG 2.47", "YS 1.2")',
        },
      },
      required: ['reference'],
    },
  },
  {
    name: 'list_texts',
    description: `List available scriptures in the corpus, optionally filtered by category.
Use to understand what texts are available or to answer "what scriptures do you have?"`,
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          enum: [
            'vedas',
            'upanishads',
            'epics',
            'puranas',
            'darshanas',
            'sastras',
          ],
          description: 'Filter by category. Omit to list all.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_related_passages',
    description: `Find thematically related passages from DIFFERENT texts.
Use for cross-referencing (e.g., after finding a Gita verse, find related Upanishadic teachings).`,
    input_schema: {
      type: 'object' as const,
      properties: {
        chunk_id: {
          type: 'integer',
          description: 'ID of the chunk to find related passages for',
        },
        limit: {
          type: 'integer',
          description: 'Max related passages (default 3)',
        },
      },
      required: ['chunk_id'],
    },
  },
];
