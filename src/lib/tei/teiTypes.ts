/**
 * TEI Pipeline Type Definitions
 *
 * Types for the pre-computed wisdom pipeline that replaces the GRETIL
 * real-time extraction with build-time TEI XML processing.
 */

// ─── Categories ──────────────────────────────────────────────────

export type WisdomCategory =
  | 'Vedanta'
  | 'Yoga'
  | 'Puranas'
  | 'Epics'
  | 'Dharmashastra'
  | 'Darshana'
  | 'Buddhist'
  | 'Upanishads';

export type StructureType = 'verse' | 'sutra' | 'prose';

// ─── Master Index Types ──────────────────────────────────────────

export interface WisdomTextMeta {
  id: string;                    // e.g., "astavakragita"
  displayName: string;           // e.g., "Aṣṭāvakragītā"
  category: WisdomCategory;
  originalScript: 'sa-Latn' | 'sa-Deva';
  fileName: string;              // e.g., "astavakragita.xml"
  candidateCount: number;
}

export interface StructuredReference {
  textName: string;              // e.g., "Aṣṭāvakragītā"
  chapter: number;
  chapterTitle?: string;         // e.g., "Prakaraṇa 1", "Samādhipādaḥ"
  verseStart: number;
  verseEnd: number;
  verseCount: number;
  technicalRef: string;          // e.g., "AG 1.1-2", "YS 1.2", "KAZ01.1.01"
}

export interface WisdomCandidate {
  id: string;                    // Deterministic: textId-chapter-verseStart-verseEnd
  textId: string;
  iast: string;                  // IAST transliteration of the Sanskrit
  devanagari: string;            // Devanagari script version
  reference: StructuredReference;
  structureType: StructureType;
  qualityScore: number;          // 0.0 - 1.0
  charCount: number;
}

export interface WisdomIndex {
  version: string;
  generatedAt: string;           // ISO timestamp
  texts: WisdomTextMeta[];
  candidates: WisdomCandidate[];
}

// ─── Batch Types ─────────────────────────────────────────────────

export interface PreparedWisdomCard extends WisdomCandidate {
  guruInterpretation: string;    // Pre-computed Gemini output
  reflectionPrompt: string;      // Pre-computed reflection question
  pdfFileName: string;           // e.g., "astavakragita-1-1-2.pdf"
  preparedAt: string;            // ISO timestamp
}

export interface WisdomBatch {
  version: string;
  generatedAt: string;
  cards: PreparedWisdomCard[];
  usedCardIds: string[];         // Tracks rotation
}

// ─── TEI Parser Types ────────────────────────────────────────────

export interface TEIDocument {
  id: string;
  title: string;
  lang: 'sa-Latn' | 'sa-Deva';
  body: TEIBody;
}

export interface TEIBody {
  divisions: TEIDivision[];
}

export interface TEIDivision {
  n?: string;
  type?: string;                 // "chapter", "pāda", "sūtra_with_bhāṣya", "book"
  head?: string;
  verses: TEIVerse[];
  paragraphs: TEIParagraph[];
  children: TEIDivision[];
}

export interface TEIVerse {
  id?: string;
  n?: string;
  lines: string[];
}

export interface TEIParagraph {
  label?: string;                // e.g., "KAZ01.1.01", "[YS 1.1]"
  text: string;
  isSutra: boolean;              // true if inside <quote type="sutra">
}

// ─── Raw Candidate (pre-scoring, pre-transliteration) ────────────

export interface RawCandidate {
  text: string;
  reference: StructuredReference;
  structureType: StructureType;
}

// ─── Curated Text Config ─────────────────────────────────────────

export interface CuratedTextConfig {
  fileName: string;
  category: WisdomCategory;
  script: 'sa-Latn' | 'sa-Deva';
  displayName?: string;          // Override extracted title
}
