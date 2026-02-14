/**
 * Quality Scorer
 *
 * Heuristic scoring of wisdom candidates across four dimensions:
 *   1. Completeness — does the text look like a complete verse/sutra?
 *   2. Self-containedness — penalizes references to external context
 *   3. Length — preference for ideal reading length
 *   4. Spiritual content — bonus for spiritual vocabulary
 *
 * Each dimension is weighted equally (0.25). Minimum threshold: 0.5.
 */

import type { RawCandidate } from './teiTypes';

export const QUALITY_THRESHOLD = 0.5;

// ─── Public API ──────────────────────────────────────────────────

export function scoreCandidate(candidate: RawCandidate): number {
  const completeness = scoreCompleteness(candidate);
  const selfContained = scoreSelfContainedness(candidate);
  const length = scoreLength(candidate);
  const spiritual = scoreSpiritualContent(candidate);

  const total = (completeness + selfContained + length + spiritual) * 0.25;
  return Math.max(0, Math.min(1, total));
}

// ─── Dimension 1: Completeness ───────────────────────────────────

function scoreCompleteness(candidate: RawCandidate): number {
  const { text, structureType } = candidate;

  // Sutras are inherently complete (short aphoristic statements)
  if (structureType === 'sutra') return 1.0;

  // Verses — check for verse-ending markers
  if (structureType === 'verse') {
    // Double danda (Unicode ॥ or ||) indicates a complete verse
    if (text.includes('॥') || text.includes('||')) return 1.0;
    // Single danda
    if (text.includes('|') || text.includes('।')) return 0.7;
    return 0.3;
  }

  // Prose — check for sentence-ending punctuation
  if (text.endsWith('|') || text.endsWith('.') || text.endsWith('।')) return 0.8;
  return 0.4;
}

// ─── Dimension 2: Self-containedness ─────────────────────────────

const CONTEXT_DEPENDENT_MARKERS = [
  'tathā coktam',     // "thus it was said"
  'yathoktam',        // "as stated"
  'pūrvoktam',        // "as previously said"
  'ityuktam',         // "thus said"
  'tathoktam',        // "so said"
  'yathā',            // "just as" (weaker marker)
  'atra',             // "here" (contextual reference)
  'tatrāha',          // "there he says"
  'tatra',            // "there" (contextual, but common)
  // Devanagari equivalents
  'तथा चोक्तम्',
  'यथोक्तम्',
  'पूर्वोक्तम्',
  'इत्युक्तम्',
];

function scoreSelfContainedness(candidate: RawCandidate): number {
  const textLower = candidate.text.toLowerCase();
  let score = 1.0;

  for (const marker of CONTEXT_DEPENDENT_MARKERS) {
    if (textLower.includes(marker.toLowerCase())) {
      score -= 0.3;
    }
  }

  return Math.max(0, score);
}

// ─── Dimension 3: Length ─────────────────────────────────────────

function scoreLength(candidate: RawCandidate): number {
  const len = candidate.text.length;

  // Sutra: shorter is fine (10-300 chars)
  if (candidate.structureType === 'sutra') {
    if (len >= 20 && len <= 200) return 1.0;
    if (len >= 10 && len <= 300) return 0.7;
    return 0.3;
  }

  // Verse and prose: ideal range 80-350, acceptable 50-500
  if (len >= 80 && len <= 350) return 1.0;
  if (len >= 50 && len <= 500) return 0.6;
  if (len >= 30 && len <= 600) return 0.3;
  return 0.1;
}

// ─── Dimension 4: Spiritual Content ─────────────────────────────

const SPIRITUAL_TERMS_IAST = [
  'ātman', 'ātmā', 'atman',
  'brahman', 'brahma',
  'dharma',
  'mokṣa', 'moksha',
  'yoga',
  'jñāna', 'jnana',
  'bhakti',
  'karma',
  'dhyāna', 'dhyana',
  'samādhi', 'samadhi',
  'tattva',
  'sattva',
  'nirvāṇa', 'nirvana',
  'mukti',
  'ānanda', 'ananda',
  'satya',
  'ahiṃsā', 'ahimsa',
  'śānti', 'shanti',
  'māyā', 'maya',
  'guru',
  'deva',
  'prajñā', 'prajna',
  'citta',
  'manas',
  'buddhi',
  'puruṣa', 'purusha',
  'prakṛti', 'prakriti',
  'vairāgya', 'vairagya',
  'viveka',
  'kaivalya',
  'sūtra', 'sutra',
  'śruti', 'shruti',
  'smṛti', 'smriti',
  'tapas',
  'prāṇa', 'prana',
];

const SPIRITUAL_TERMS_DEVA = [
  'आत्मन्', 'आत्मा',
  'ब्रह्म',
  'धर्म',
  'मोक्ष',
  'योग',
  'ज्ञान',
  'भक्ति',
  'कर्म',
  'ध्यान',
  'समाधि',
  'तत्त्व',
  'सत्त्व',
  'निर्वाण',
  'मुक्ति',
  'आनन्द',
  'सत्य',
  'अहिंसा',
  'शान्ति',
  'माया',
  'गुरु',
  'देव',
  'प्रज्ञा',
  'चित्त',
  'मनस्',
  'बुद्धि',
  'पुरुष',
  'प्रकृति',
  'वैराग्य',
  'विवेक',
  'कैवल्य',
  'तपस्',
  'प्राण',
];

function scoreSpiritualContent(candidate: RawCandidate): number {
  const textLower = candidate.text.toLowerCase();
  let matchCount = 0;

  for (const term of SPIRITUAL_TERMS_IAST) {
    if (textLower.includes(term)) {
      matchCount++;
    }
  }

  for (const term of SPIRITUAL_TERMS_DEVA) {
    if (candidate.text.includes(term)) {
      matchCount++;
    }
  }

  // 0.15 per match, capped at 1.0
  return Math.min(1.0, matchCount * 0.15);
}
