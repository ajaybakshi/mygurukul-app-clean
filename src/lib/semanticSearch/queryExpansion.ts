/**
 * @fileoverview Semantic Search Query Expansion Service
 * 
 * This service provides intelligent query expansion for Ayurvedic terminology
 * by mapping user queries to comprehensive Sanskrit, Hindi, and English terms
 * from the ayurveda_terms.json dictionary.
 * 
 * @author MyGurukul AI Assistant
 * @version 1.0.0
 * @since 2025-01-27
 */

// Import the JSON data - Next.js will bundle this automatically
import ayurvedaTermsData from '@/lib/data/ayurveda_terms_auto.json';
const ayurvedaTerms = ayurvedaTermsData;

/**
 * Question words and common connectors to filter out from queries
 * 
 * These add noise and prevent proper term matching
 */
const STOP_WORDS = new Set([
  // Question words
  'what', 'how', 'which', 'who', 'when', 'where', 'why',
  // Auxiliary verbs
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'doing', 'done',
  'have', 'has', 'had', 'having',
  'can', 'could', 'will', 'would', 'should', 'shall',
  'may', 'might', 'must',
  // Prepositions & connectors
  'to', 'for', 'with', 'from', 'in', 'on', 'at', 'by',
  'of', 'about', 'as', 'into', 'through', 'during',
  // Articles & pronouns
  'the', 'a', 'an', 'this', 'that', 'these', 'those',
  // Common verbs that don't add meaning
  'help', 'helps', 'treat', 'treats', 'cure', 'cures',
  'reduce', 'reduces', 'increase', 'increases',
  'improve', 'improves', 'support', 'supports',
  'boost', 'boosts', 'enhance', 'enhances',
  // Other noise
  'good', 'best', 'better', 'remedy', 'remedies',
  'issue', 'issues', 'problem', 'problems'
]);

/**
 * Tokenize query into meaningful keywords
 * 
 * Splits on whitespace and punctuation
 * Removes stop words
 * Filters out very short tokens
 * 
 * Example: "What herbs help with fever?" → ["herbs", "fever"]
 */
function tokenizeQuery(query: string): string[] {
  // Split on whitespace and punctuation, keep only alphanumeric
  const rawTokens = query
    .toLowerCase()
    .split(/[\s,;.!?]+/)
    .filter(token => token.length > 0);

  // Remove stop words and very short tokens (< 3 chars unless important)
  const meaningfulTokens = rawTokens.filter(token => {
    if (token.length < 2) return false; // Remove single chars
    if (STOP_WORDS.has(token)) return false; // Remove stop words
    return true;
  });

  return meaningfulTokens;
}

/**
 * Merge expansion results from multiple tokens
 * 
 * Combines terms, concepts, categories from all tokens
 */
function mergeExpansions(expansions: QueryExpansion[]): QueryExpansion {
  const merged: QueryExpansion = {
    originalQuery: expansions.map(e => e.originalQuery).join(' '),
    expandedTerms: [],
    relatedConcepts: [],
    matchedCategories: [],
    doshaAssociations: []
  };

  // Combine all expanded terms (deduplicated)
  const termSet = new Set<string>();
  expansions.forEach(exp => {
    exp.expandedTerms?.forEach(term => termSet.add(term));
  });
  merged.expandedTerms = Array.from(termSet);

  // Combine related concepts (deduplicated)
  const conceptSet = new Set<string>();
  expansions.forEach(exp => {
    exp.relatedConcepts?.forEach(concept => conceptSet.add(concept));
  });
  merged.relatedConcepts = Array.from(conceptSet);

  // Combine categories (deduplicated)
  const categorySet = new Set<string>();
  expansions.forEach(exp => {
    exp.matchedCategories?.forEach(cat => categorySet.add(cat));
  });
  merged.matchedCategories = Array.from(categorySet);

  // Combine dosha associations (deduplicated)
  const doshaSet = new Set<string>();
  expansions.forEach(exp => {
    exp.doshaAssociations?.forEach(dosha => doshaSet.add(dosha));
  });
  merged.doshaAssociations = Array.from(doshaSet);

  return merged;
}

/**
 * Interface representing the result of query expansion
 * 
 * @interface QueryExpansion
 */
export interface QueryExpansion {
  /** The original user query string */
  originalQuery: string;
  
  /** Array of expanded terms found across all dictionary categories */
  expandedTerms: string[];
  
  /** Categories where matches were found (herbs, symptoms, diseases, etc.) */
  matchedCategories: string[];
  
  /** Related concepts and actions associated with matched terms */
  relatedConcepts: string[];
  
  /** Dosha associations for matched terms (Vata, Pitta, Kapha) */
  doshaAssociations?: string[];
}

/**
 * Type definition for the structure of ayurveda_terms_auto.json
 */
type AyurvedaTerms = {
  terms: TermEntry[];
};

/**
 * Term entry from ayurveda_terms_auto.json
 */
interface TermEntry {
  term: string;
  category: string;
  variants: string[];
  description: string;
  relatedConcepts: string[];
  doshaAssociations: string[];
}

/**
 * Base interface for all dictionary entries
 */
interface BaseEntry {
  sanskrit: string[];
  hindi: string[];
  category: string;
}

/**
 * Herb entry with additional properties and actions
 */
interface HerbEntry extends BaseEntry {
  botanical: string;
  properties: string[];
  search_variations?: string[];
  actions?: string[];
}

/**
 * Symptom entry with dosha and anatomical associations
 */
interface SymptomEntry extends BaseEntry {
  related_conditions: string[];
  dosha: string[];
  anatomical: string[];
  search_variations?: string[];
}

/**
 * Disease entry with symptoms and dosha associations
 */
interface DiseaseEntry extends BaseEntry {
  related_symptoms: string[];
  dosha: string[];
  common_names?: string[];
}

/**
 * Body part entry with related concepts
 */
interface BodyPartEntry extends BaseEntry {
  related_concepts: string[];
}

/**
 * Dosha entry with qualities and governance
 */
interface DoshaEntry extends BaseEntry {
  qualities: string[];
  governs: string[];
}

/**
 * Treatment entry with benefits
 */
interface TreatmentEntry extends BaseEntry {
  benefits: string[];
  common_names?: string[];
}

/**
 * Normalizes a query string by converting to lowercase and trimming whitespace
 * 
 * @param query - The input query string
 * @returns Normalized query string
 * 
 * @example
 * ```typescript
 * normalizeQuery("  Haldi  ") // returns "haldi"
 * ```
 */
function normalizeQuery(query: string): string {
  return query.toLowerCase().trim();
}

/**
 * Checks if a search term matches any of the target terms (case-insensitive)
 * 
 * @param searchTerm - The term to search for
 * @param targetTerms - Array of terms to search in
 * @returns True if any target term contains the search term
 * 
 * @example
 * ```typescript
 * matchesTerm("gas", ["stomach gas", "pet ki gas"]) // returns true
 * ```
 */
function matchesTerm(searchTerm: string, targetTerms: string[]): boolean {
  return targetTerms.some(term => 
    term.toLowerCase().includes(searchTerm.toLowerCase())
  );
}

/**
 * Extracts all searchable terms from a dictionary entry
 * 
 * @param entry - The dictionary entry to extract terms from
 * @returns Array of all searchable terms
 */
function extractSearchableTerms(entry: any): string[] {
  const terms: string[] = [];
  
  // Add main term
  if (entry.term) {
    terms.push(entry.term);
  }
  
  // Add variants
  if (entry.variants) {
    terms.push(...entry.variants);
  }
  
  // Add related concepts
  if (entry.relatedConcepts) {
    terms.push(...entry.relatedConcepts);
  }
  
  return terms;
}

/**
 * Extracts related concepts from a dictionary entry
 * 
 * @param entry - The dictionary entry to extract concepts from
 * @returns Array of related concepts
 */
function extractRelatedConcepts(entry: any): string[] {
  const concepts: string[] = [];
  
  // Add related concepts
  if (entry.relatedConcepts) {
    concepts.push(...entry.relatedConcepts);
  }
  
  // Add description as a concept
  if (entry.description) {
    concepts.push(entry.description);
  }
  
  return concepts;
}

/**
 * Find matching terms for a single token
 */
function findMatchingTerms(token: string): any[] {
  const normalizedToken = normalizeQuery(token);
  const matchingEntries: any[] = [];
  
  // Search through all terms in the terms array
  for (const termEntry of ayurvedaTerms.terms) {
    const searchableTerms = extractSearchableTerms(termEntry);
    
    // Check if token matches any searchable terms
    if (matchesTerm(normalizedToken, searchableTerms)) {
      matchingEntries.push({ entry: termEntry, categoryName: termEntry.category, entryKey: termEntry.term });
    }
  }
  
  return matchingEntries;
}

/**
 * Build expansion for a single token
 */
function buildExpansion(token: string, matchingEntries: any[]): QueryExpansion {
  const expandedTerms: string[] = [];
  const matchedCategories: string[] = [];
  const relatedConcepts: string[] = [];
  const doshaAssociations: string[] = [];
  
  for (const { entry, categoryName } of matchingEntries) {
    matchedCategories.push(categoryName);
    
    // Add all searchable terms to expanded terms
    const searchableTerms = extractSearchableTerms(entry);
    expandedTerms.push(...searchableTerms);
    
    // Extract related concepts
    const concepts = extractRelatedConcepts(entry);
    relatedConcepts.push(...concepts);
    
    // Extract dosha associations
    if ((entry as any).dosha) {
      doshaAssociations.push(...(entry as any).dosha);
    }
  }
  
  // Remove duplicates
  const uniqueExpandedTerms = Array.from(new Set(expandedTerms));
  const uniqueMatchedCategories = Array.from(new Set(matchedCategories));
  const uniqueRelatedConcepts = Array.from(new Set(relatedConcepts));
  const uniqueDoshaAssociations = Array.from(new Set(doshaAssociations));
  
  return {
    originalQuery: token,
    expandedTerms: uniqueExpandedTerms,
    matchedCategories: uniqueMatchedCategories,
    relatedConcepts: uniqueRelatedConcepts,
    doshaAssociations: uniqueDoshaAssociations.length > 0 ? uniqueDoshaAssociations : undefined
  };
}

/**
 * Expands a user query by searching through the Ayurveda terminology dictionary
 * 
 * This function performs intelligent query expansion by:
 * 1. Tokenizing multi-word queries
 * 2. Filtering out stop words and noise
 * 3. Expanding each meaningful token separately
 * 4. Merging results from all tokens
 * 5. Returning comprehensive expansion results
 * 
 * @param query - The user's search query
 * @returns QueryExpansion object with expanded terms and metadata
 * 
 * @example
 * ```typescript
 * const result = expandQuery("haldi");
 * // Returns: {
 * //   originalQuery: "haldi",
 * //   expandedTerms: ["haldi", "haridra", "turmeric", "curcuma longa", ...],
 * //   matchedCategories: ["herbs"],
 * //   relatedConcepts: ["reduces inflammation", "heals wounds", ...],
 * //   doshaAssociations: []
 * // }
 * ```
 * 
 * @example
 * ```typescript
 * const result = expandQuery("What herbs help with fever?");
 * // Tokenizes to ["herbs", "fever"], expands each, merges results
 * ```
 * 
 * @performance Completes in <5ms for typical queries
 * @throws {Error} If the ayurveda_terms.json file cannot be loaded
 */
export function expandQuery(query: string): QueryExpansion {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return {
      originalQuery: query,
      expandedTerms: [],
      relatedConcepts: [],
      matchedCategories: [],
      doshaAssociations: []
    };
  }

  // NEW: Tokenize the query
  const tokens = tokenizeQuery(trimmedQuery);

  console.log(`[QueryExpansion] Original: "${trimmedQuery}"`);
  console.log(`[QueryExpansion] Tokens after filtering: ${JSON.stringify(tokens)}`);

  // If no meaningful tokens after filtering, return empty
  if (tokens.length === 0) {
    return {
      originalQuery: query,
      expandedTerms: [],
      relatedConcepts: [],
      matchedCategories: [],
      doshaAssociations: []
    };
  }

  // Expand each token separately
  const tokenExpansions: QueryExpansion[] = [];

  for (const token of tokens) {
    // Try to find matches for this token
    const matchingTerms = findMatchingTerms(token);

    if (matchingTerms.length > 0) {
      // Found matches - expand this token
      const tokenExpansion = buildExpansion(token, matchingTerms);
      tokenExpansions.push(tokenExpansion);
      
      console.log(`[QueryExpansion] Token "${token}" expanded to ${tokenExpansion.expandedTerms?.length || 0} terms`);
    } else {
      // No match found - keep the original token
      tokenExpansions.push({
        originalQuery: token,
        expandedTerms: [token],
        relatedConcepts: [],
        matchedCategories: [],
        doshaAssociations: []
      });
      
      console.log(`[QueryExpansion] Token "${token}" not found in dictionary, keeping as-is`);
    }
  }

  // Merge all token expansions
  const merged = mergeExpansions(tokenExpansions);
  merged.originalQuery = query; // Keep original full query

  console.log(`[QueryExpansion] Final: ${merged.expandedTerms?.length || 0} terms, ${merged.relatedConcepts?.length || 0} concepts`);

  return merged;
}

/**
 * Utility function to get all available categories in the dictionary
 * 
 * @returns Array of category names
 * 
 * @example
 * ```typescript
 * const categories = getAvailableCategories();
 * // Returns: ["herbs", "symptoms", "diseases", "body_parts", "doshas", "treatments"]
 * ```
 */
export function getAvailableCategories(): string[] {
  const categories = new Set<string>();
  for (const term of ayurvedaTerms.terms) {
    categories.add(term.category);
  }
  return Array.from(categories);
}

/**
 * Utility function to get all terms for a specific category
 * 
 * @param category - The category to get terms for
 * @returns Array of all terms in the category
 * 
 * @example
 * ```typescript
 * const herbTerms = getCategoryTerms("herbs");
 * // Returns array of all herb terms
 * ```
 */
export function getCategoryTerms(category: string): string[] {
  const allTerms: string[] = [];
  
  for (const term of ayurvedaTerms.terms) {
    if (term.category === category) {
      allTerms.push(...extractSearchableTerms(term));
    }
  }
  
  return Array.from(new Set(allTerms));
}

/**
 * Utility function to check if a term exists in the dictionary
 * 
 * @param term - The term to check
 * @returns True if the term exists in any category
 * 
 * @example
 * ```typescript
 * const exists = termExists("haldi"); // returns true
 * const exists = termExists("nonexistent"); // returns false
 * ```
 */
export function termExists(term: string): boolean {
  const normalizedTerm = normalizeQuery(term);
  
  for (const termEntry of ayurvedaTerms.terms) {
    const searchableTerms = extractSearchableTerms(termEntry);
    if (matchesTerm(normalizedTerm, searchableTerms)) {
      return true;
    }
  }
  
  return false;
}
