/**
 * Amarakosha Service — Ancient Sanskrit Thesaurus for Concept Expansion
 *
 * The Amarakosha (Nāmaliṅgānuśāsana) by Amarasimha (~4th century CE) is the
 * oldest surviving Sanskrit thesaurus. It maps concepts to ALL their Sanskrit
 * synonyms in verse form.
 *
 * This service queries the pre-populated `amarakosha` DB table to expand
 * English concepts into Sanskrit search terms, dramatically improving
 * retrieval against the IAST Sanskrit corpus.
 *
 * Example: "vishnu" → 46 names (nārāyaṇa, kṛṣṇa, govinda, keśava, mādhava...)
 * Example: "heaven" → svarga, nāka, tridiva, tridaśālaya, suraloka...
 */

import { sql } from '@/lib/db';

export interface ConceptExpansion {
  original_term: string;
  sanskrit_terms: string[];
  english_gloss: string | null;
  category: string | null;
}

/**
 * Supplementary concept map for common spiritual terms not in Amarakosha.
 * These are well-known Sanskrit equivalents that Haiku may also suggest,
 * but having them here ensures consistent expansion.
 */
const SUPPLEMENTARY_CONCEPTS: Record<string, string[]> = {
  meditation: ['dhyāna', 'yoga', 'samādhi', 'dhāraṇā', 'upāsanā'],
  karma: ['karma', 'kṛtya', 'phala', 'kriyā'],
  soul: ['ātman', 'jīva', 'puruṣa', 'cetanā'],
  liberation: ['mokṣa', 'mukti', 'nirvāṇa', 'kaivalya', 'apavarga'],
  truth: ['satya', 'ṛta', 'tattva', 'paramārtha'],
  duty: ['dharma', 'kartavya', 'svadharma'],
  knowledge: ['jñāna', 'vidyā', 'prajñā', 'bodha'],
  devotion: ['bhakti', 'śraddhā', 'upāsanā', 'sevā'],
  action: ['karma', 'kriyā', 'ceṣṭā', 'pravṛtti'],
  peace: ['śānti', 'praśānti', 'upaśama', 'kṣema'],
  compassion: ['karuṇā', 'dayā', 'kṛpā', 'anukampā'],
  fear: ['bhaya', 'trāsa', 'bhīti', 'sādhvasam', 'udvega'],
  courage: ['abhaya', 'śaurya', 'vikrama', 'dhairya', 'vīrya'],
  anger: ['krodha', 'kopa', 'roṣa', 'manyu', 'amarṣa'],
  desire: ['kāma', 'icchā', 'spṛhā', 'tṛṣṇā', 'rāga'],
  suffering: ['duḥkha', 'kleśa', 'pīḍā', 'vedanā', 'tāpa'],
  happiness: ['sukha', 'ānanda', 'harṣa', 'prīti', 'tuṣṭi'],
  wisdom: ['prajñā', 'medhā', 'mati', 'dhī', 'buddhi'],
  ignorance: ['avidyā', 'ajñāna', 'moha', 'mithyā'],
  renunciation: ['tyāga', 'vairāgya', 'sannyāsa', 'nivṛtti'],
  teacher: ['guru', 'ācārya', 'upādhyāya', 'śikṣaka'],
  god: ['īśvara', 'bhagavān', 'deva', 'paramātman', 'brahman'],
  death: ['mṛtyu', 'kāla', 'antaka', 'yama', 'maraṇa'],
  birth: ['janma', 'jāti', 'utpatti', 'prādurbhāva'],
  world: ['loka', 'jagat', 'saṃsāra', 'viśva', 'bhuvana'],
  mind: ['manas', 'citta', 'buddhi', 'antaḥkaraṇa'],
  body: ['deha', 'śarīra', 'tanu', 'kāya', 'vigraha'],
  breath: ['prāṇa', 'vāyu', 'svāsa', 'prāṇāyāma'],
  yoga: ['yoga', 'samādhi', 'dhyāna', 'yukti'],
  sacrifice: ['yajña', 'homa', 'havana', 'iṣṭi'],
  prayer: ['prārthanā', 'stuti', 'stotra', 'namaskāra'],
  sin: ['pāpa', 'doṣa', 'kalmaṣa', 'āgas', 'enas'],
  virtue: ['puṇya', 'dharma', 'śīla', 'sadācāra', 'guṇa'],
  health: ['ārogya', 'svāsthya', 'nirujtā'],
  disease: ['roga', 'vyādhi', 'āmaya', 'gadā', 'rujā'],
  food: ['anna', 'āhāra', 'bhojana', 'bhakṣya'],
  water: ['jala', 'ap', 'vāri', 'udaka', 'ambu', 'nīra', 'salila'],
  fire: ['agni', 'anala', 'pāvaka', 'vahni', 'hutāśana'],
  love: ['prema', 'sneha', 'prīti', 'anurāga', 'anurakti'],
  war: ['yuddha', 'saṅgrāma', 'raṇa', 'saṃyuga', 'samara'],
  king: ['rājan', 'nṛpa', 'bhūpati', 'narendra', 'bhūpāla'],
  woman: ['strī', 'nārī', 'vanitā', 'mahilā', 'yoṣit'],
  man: ['nara', 'puruṣa', 'manuṣya', 'mānava', 'mānuṣa'],
  child: ['bāla', 'śiśu', 'kumāra', 'arbhaka'],
  forest: ['vana', 'araṇya', 'kānana', 'vipin', 'gahana'],
  river: ['nadī', 'sarit', 'āpagā', 'taraṅgiṇī', 'srotasvinī'],
  mountain: ['parvata', 'giri', 'adri', 'śaila', 'acala', 'naga'],
  ocean: ['samudra', 'sāgara', 'sindhu', 'ambhodhi', 'jaladhi', 'ratnākara'],
};

/**
 * Expand an English concept to Sanskrit terms using the Amarakosha DB.
 * Falls back to supplementary concept map if not found in DB.
 */
export async function expandConcept(concept: string): Promise<ConceptExpansion> {
  const term = concept.toLowerCase().trim();

  // 1. Try exact English gloss match in Amarakosha
  const glossResult = await sql`
    SELECT term, synonyms, english_gloss, category
    FROM amarakosha
    WHERE english_gloss = ${term}
    LIMIT 10
  `;

  if (glossResult.rows.length > 0) {
    const allTerms = new Set<string>();
    let gloss = null;
    let cat = null;
    for (const row of glossResult.rows) {
      allTerms.add(row.term);
      for (const syn of row.synonyms) allTerms.add(syn);
      if (!gloss) gloss = row.english_gloss;
      if (!cat) cat = row.category;
    }
    return {
      original_term: concept,
      sanskrit_terms: Array.from(allTerms),
      english_gloss: gloss,
      category: cat,
    };
  }

  // 2. Try partial match on English gloss
  const partialResult = await sql`
    SELECT term, synonyms, english_gloss, category
    FROM amarakosha
    WHERE english_gloss LIKE ${`%${term}%`}
    LIMIT 10
  `;

  if (partialResult.rows.length > 0) {
    const allTerms = new Set<string>();
    for (const row of partialResult.rows) {
      allTerms.add(row.term);
      for (const syn of row.synonyms) allTerms.add(syn);
    }
    return {
      original_term: concept,
      sanskrit_terms: Array.from(allTerms),
      english_gloss: partialResult.rows[0].english_gloss,
      category: partialResult.rows[0].category,
    };
  }

  // 3. Try Sanskrit term lookup (user might pass a Sanskrit word)
  const termResult = await sql`
    SELECT term, synonyms, english_gloss, category
    FROM amarakosha
    WHERE term = ${term}
    LIMIT 1
  `;

  if (termResult.rows.length > 0) {
    const row = termResult.rows[0];
    return {
      original_term: concept,
      sanskrit_terms: [row.term, ...row.synonyms],
      english_gloss: row.english_gloss,
      category: row.category,
    };
  }

  // 4. Fall back to supplementary concept map
  if (SUPPLEMENTARY_CONCEPTS[term]) {
    return {
      original_term: concept,
      sanskrit_terms: SUPPLEMENTARY_CONCEPTS[term],
      english_gloss: null,
      category: null,
    };
  }

  // 5. No match found
  return {
    original_term: concept,
    sanskrit_terms: [],
    english_gloss: null,
    category: null,
  };
}

/**
 * Expand multiple concepts at once.
 * Returns all expansions, including empty ones (no match).
 */
export async function expandConcepts(concepts: string[]): Promise<ConceptExpansion[]> {
  return Promise.all(concepts.map(c => expandConcept(c)));
}

/**
 * Reverse lookup: given a Sanskrit term, find its English meaning and all synonyms.
 */
export async function lookupSanskritTerm(term: string): Promise<ConceptExpansion | null> {
  const normalized = term.toLowerCase().trim();

  const result = await sql`
    SELECT term, synonyms, english_gloss, category
    FROM amarakosha
    WHERE term = ${normalized}
       OR ${normalized} = ANY(synonyms)
    LIMIT 5
  `;

  if (result.rows.length === 0) return null;

  const allTerms = new Set<string>();
  for (const row of result.rows) {
    allTerms.add(row.term);
    for (const syn of row.synonyms) allTerms.add(syn);
  }

  return {
    original_term: term,
    sanskrit_terms: Array.from(allTerms),
    english_gloss: result.rows[0].english_gloss,
    category: result.rows[0].category,
  };
}
