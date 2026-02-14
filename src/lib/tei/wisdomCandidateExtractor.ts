/**
 * Wisdom Candidate Extractor
 *
 * Extracts wisdom candidates from parsed TEI documents using three strategies:
 *   1. Verse extraction — groups of 1-3 adjacent <lg> elements
 *   2. Sutra extraction — sutra text from <quote type="sutra"> paragraphs
 *   3. Prose extraction — labeled paragraphs from Arthashastra-style texts
 *
 * Each candidate includes raw text, structured reference, and structure type.
 */

import type {
  TEIDocument,
  TEIDivision,
  TEIVerse,
  TEIParagraph,
  RawCandidate,
  StructuredReference,
  StructureType,
} from './teiTypes';

// ─── Character limits ────────────────────────────────────────────

const VERSE_MIN_CHARS = 50;
const VERSE_MAX_CHARS = 500;
const SUTRA_MIN_CHARS = 10;
const SUTRA_MAX_CHARS = 300;
const PROSE_MIN_CHARS = 50;
const PROSE_MAX_CHARS = 500;

// ─── Public API ──────────────────────────────────────────────────

/**
 * Extract all wisdom candidates from a parsed TEI document.
 * Automatically detects which extraction strategy to use based on content.
 */
export function extractCandidates(doc: TEIDocument): RawCandidate[] {
  const candidates: RawCandidate[] = [];

  walkDivisions(doc.body.divisions, doc.title, candidates);

  return candidates;
}

// ─── Division Walker ─────────────────────────────────────────────

function walkDivisions(
  divisions: TEIDivision[],
  textName: string,
  candidates: RawCandidate[],
  parentChapter?: number,
  parentChapterTitle?: string
): void {
  for (const div of divisions) {
    const chapter = parseChapterNumber(div) ?? parentChapter ?? 1;
    const chapterTitle = div.head || parentChapterTitle;

    // Strategy 1: Verse extraction
    if (div.verses.length > 0) {
      const verseCandidates = extractFromVerses(
        div.verses, textName, chapter, chapterTitle
      );
      candidates.push(...verseCandidates);
    }

    // Strategy 2: Sutra extraction
    const sutraParagraphs = div.paragraphs.filter(p => p.isSutra);
    if (sutraParagraphs.length > 0) {
      const sutraCandidates = extractFromSutras(
        sutraParagraphs, textName, chapter, chapterTitle
      );
      candidates.push(...sutraCandidates);
    }

    // Strategy 3: Prose extraction (labeled, non-sutra paragraphs)
    const labeledProse = div.paragraphs.filter(p => !p.isSutra && p.label);
    if (labeledProse.length > 0) {
      const proseCandidates = extractFromProse(
        labeledProse, textName, chapter, chapterTitle
      );
      candidates.push(...proseCandidates);
    }

    // Recurse into child divisions
    if (div.children.length > 0) {
      walkDivisions(div.children, textName, candidates, chapter, chapterTitle);
    }
  }
}

// ─── Strategy 1: Verse Extraction ────────────────────────────────

/**
 * For each verse, try groups of 1, 2, and 3 adjacent verses.
 * This creates overlapping windows that capture different units of meaning.
 */
function extractFromVerses(
  verses: TEIVerse[],
  textName: string,
  chapter: number,
  chapterTitle?: string
): RawCandidate[] {
  const candidates: RawCandidate[] = [];

  for (let i = 0; i < verses.length; i++) {
    // Single verse
    const single = joinVerseLines(verses.slice(i, i + 1));
    if (isInRange(single.length, VERSE_MIN_CHARS, VERSE_MAX_CHARS)) {
      candidates.push({
        text: single,
        reference: buildVerseRef(textName, chapter, chapterTitle, verses, i, i),
        structureType: 'verse',
      });
    }

    // Two adjacent verses
    if (i + 1 < verses.length) {
      const pair = joinVerseLines(verses.slice(i, i + 2));
      if (isInRange(pair.length, VERSE_MIN_CHARS, VERSE_MAX_CHARS)) {
        candidates.push({
          text: pair,
          reference: buildVerseRef(textName, chapter, chapterTitle, verses, i, i + 1),
          structureType: 'verse',
        });
      }
    }

    // Three adjacent verses
    if (i + 2 < verses.length) {
      const triple = joinVerseLines(verses.slice(i, i + 3));
      if (isInRange(triple.length, VERSE_MIN_CHARS, VERSE_MAX_CHARS)) {
        candidates.push({
          text: triple,
          reference: buildVerseRef(textName, chapter, chapterTitle, verses, i, i + 2),
          structureType: 'verse',
        });
      }
    }
  }

  return candidates;
}

// ─── Strategy 2: Sutra Extraction ────────────────────────────────

function extractFromSutras(
  paragraphs: TEIParagraph[],
  textName: string,
  chapter: number,
  chapterTitle?: string
): RawCandidate[] {
  const candidates: RawCandidate[] = [];

  for (const p of paragraphs) {
    // Clean the sutra text: remove the label brackets if embedded
    const cleanText = cleanSutraText(p.text);
    if (!isInRange(cleanText.length, SUTRA_MIN_CHARS, SUTRA_MAX_CHARS)) continue;

    const ref = buildSutraRef(textName, chapter, chapterTitle, p.label);
    candidates.push({
      text: cleanText,
      reference: ref,
      structureType: 'sutra',
    });
  }

  return candidates;
}

// ─── Strategy 3: Prose Extraction ────────────────────────────────

function extractFromProse(
  paragraphs: TEIParagraph[],
  textName: string,
  chapter: number,
  chapterTitle?: string
): RawCandidate[] {
  const candidates: RawCandidate[] = [];

  for (const p of paragraphs) {
    // Strip the label from the beginning of the text
    let text = p.text;
    if (p.label && text.startsWith(p.label)) {
      text = text.slice(p.label.length).trim();
    }

    if (!isInRange(text.length, PROSE_MIN_CHARS, PROSE_MAX_CHARS)) continue;

    const ref = buildProseRef(textName, chapter, chapterTitle, p.label);
    candidates.push({
      text,
      reference: ref,
      structureType: 'prose',
    });
  }

  return candidates;
}

// ─── Reference Builders ──────────────────────────────────────────

function buildVerseRef(
  textName: string,
  chapter: number,
  chapterTitle: string | undefined,
  verses: TEIVerse[],
  startIdx: number,
  endIdx: number
): StructuredReference {
  const startVerse = parseVerseNumber(verses[startIdx]);
  const endVerse = parseVerseNumber(verses[endIdx]);

  // Use verse-level chapter detection if available (for flat-body files like Katha)
  const verseChapter = parseChapterFromVerse(verses[startIdx]) ?? chapter;

  const abbrev = makeAbbreviation(textName);
  const technicalRef = startVerse === endVerse
    ? `${abbrev} ${verseChapter}.${startVerse}`
    : `${abbrev} ${verseChapter}.${startVerse}-${endVerse}`;

  return {
    textName,
    chapter: verseChapter,
    chapterTitle,
    verseStart: startVerse,
    verseEnd: endVerse,
    verseCount: endIdx - startIdx + 1,
    technicalRef,
  };
}

function buildSutraRef(
  textName: string,
  chapter: number,
  chapterTitle: string | undefined,
  label?: string
): StructuredReference {
  // Parse label like "[YS 1.2]"
  let verseNum = 1;
  if (label) {
    const match = label.match(/(\d+)\.(\d+)/);
    if (match) {
      chapter = parseInt(match[1], 10);
      verseNum = parseInt(match[2], 10);
    }
  }

  const abbrev = makeAbbreviation(textName);
  return {
    textName,
    chapter,
    chapterTitle,
    verseStart: verseNum,
    verseEnd: verseNum,
    verseCount: 1,
    technicalRef: `${abbrev} ${chapter}.${verseNum}`,
  };
}

function buildProseRef(
  textName: string,
  chapter: number,
  chapterTitle: string | undefined,
  label?: string
): StructuredReference {
  let verseNum = 1;
  if (label) {
    // Parse labels like "KAZ01.1.01"
    const kazMatch = label.match(/(\d+)\.(\d+)\.(\d+)/);
    if (kazMatch) {
      chapter = parseInt(kazMatch[2], 10);
      verseNum = parseInt(kazMatch[3], 10);
    } else {
      // Parse xml:id style labels like "TaittU_1.1.1" or "ChU_1.2.3"
      const idMatch = label.match(/(\d+)\.(\d+)(?:\.(\d+))?$/);
      if (idMatch) {
        chapter = parseInt(idMatch[1], 10);
        verseNum = parseInt(idMatch[2], 10);
      }
    }
  }

  const abbrev = makeAbbreviation(textName);
  return {
    textName,
    chapter,
    chapterTitle,
    verseStart: verseNum,
    verseEnd: verseNum,
    verseCount: 1,
    technicalRef: `${abbrev} ${chapter}.${verseNum}`,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────

function joinVerseLines(verses: TEIVerse[]): string {
  return verses
    .map(v => v.lines.join('\n'))
    .join('\n');
}

function parseChapterNumber(div: TEIDivision): number | undefined {
  if (div.n) {
    const num = parseInt(div.n, 10);
    if (!isNaN(num)) return num;
  }
  return undefined;
}

function parseVerseNumber(verse: TEIVerse): number {
  // Try n attribute first
  if (verse.n) {
    const num = parseInt(verse.n, 10);
    if (!isNaN(num)) return num;
  }

  // Try xml:id patterns:
  //   "R_1.001.003"     → 3   (Ramayana: book.sarga.verse)
  //   "SvetUp_1.3"      → 3   (Svetasvatara: chapter.verse)
  //   "TaittUBh_1.0.1"  → 1   (Taittiriya: valli.anuvaka.verse)
  if (verse.id) {
    // Multi-segment IDs: take the last numeric segment
    const dotMatch = verse.id.match(/\.0*(\d+)$/);
    if (dotMatch) return parseInt(dotMatch[1], 10);

    // Underscore + trailing number: "R_1" or just trailing digits
    const trailMatch = verse.id.match(/(\d+)$/);
    if (trailMatch) return parseInt(trailMatch[1], 10);
  }

  // Try inline reference in verse text: "// KaU_1.5 //" or "|| 5 ||"
  const fullText = verse.lines.join(' ');
  const inlineRef = fullText.match(/\/\/\s*\w+[_.](\d+)\.(\d+)\s*\/\//);
  if (inlineRef) return parseInt(inlineRef[2], 10);

  const barRef = fullText.match(/\|\|(\d+)\|\|/);
  if (barRef) return parseInt(barRef[1], 10);

  return 1;
}

/**
 * Parse chapter number from a verse's xml:id or inline reference.
 * Used when the division has no chapter number (no <div> wrapper).
 */
function parseChapterFromVerse(verse: TEIVerse): number | undefined {
  // From xml:id like "SvetUp_1.3" → chapter 1, or "R_1.001.003" → sarga 1
  if (verse.id) {
    const parts = verse.id.match(/[_.](\d+)\.\d+$/);
    if (parts) return parseInt(parts[1], 10);

    // Ramayana: "R_1.001.003" → sarga = 001 → 1
    const ramMatch = verse.id.match(/(\d+)\.(\d+)\.(\d+)$/);
    if (ramMatch) return parseInt(ramMatch[2], 10);
  }

  // From inline text: "// KaU_1.5 //"
  const fullText = verse.lines.join(' ');
  const inlineRef = fullText.match(/\/\/\s*\w+[_.](\d+)\.(\d+)\s*\/\//);
  if (inlineRef) return parseInt(inlineRef[1], 10);

  return undefined;
}

function cleanSutraText(text: string): string {
  // Remove embedded label references like "[YS 1.2]"
  return text
    .replace(/\[.*?\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeAbbreviation(textName: string): string {
  // Generate short abbreviation from text name
  const abbreviations: Record<string, string> = {
    'Aṣṭāvakragītā': 'AG',
    'Pātañjalayogaśāstra': 'YS',
    'Arthaśāstra': 'KAŚ',
    'Skandapurāṇa': 'SkP',
    'Brahmapurāṇa': 'BrP',
    'Manusmṛti': 'MDh',
    'Nāradasmṛti': 'NārS',
    'Buddhacarita': 'BC',
    'Sarvārthasiddhi': 'SAS',
    'Sarvadārśanasaṅgraha': 'SDhS',
    'Vākyapadīya': 'VP',
    // GRETIL additions
    'Bhagavadgītā-4comm with the commentaries of Śrīdhara, Madhusūdana, Viśvanātha and Baladeva': 'BhG',
    'Kathopaniṣad': 'KaU',
    'Chāndogyopaniṣad': 'ChU',
    'Rāmāyaṇa': 'Rām',
    'Bṛhadāraṇyakopaniṣad': 'BṛU',
    'Aitareyopaniṣad': 'AiU',
    'Śvetāśvataropaniṣad': 'ŚvU',
    'Taittirīyopaniṣad': 'TaU',
  };

  if (abbreviations[textName]) return abbreviations[textName];

  // Fallback: take first 2-3 consonants
  const clean = textName.replace(/[āīūṛṝḷḹṃḥñṅṭḍṇśṣ]/g, (c) => {
    const map: Record<string, string> = {
      'ā': 'a', 'ī': 'i', 'ū': 'u', 'ṛ': 'r', 'ṝ': 'r', 'ḷ': 'l', 'ḹ': 'l',
      'ṃ': 'm', 'ḥ': 'h', 'ñ': 'n', 'ṅ': 'n', 'ṭ': 't', 'ḍ': 'd',
      'ṇ': 'n', 'ś': 's', 'ṣ': 's',
    };
    return map[c] || c;
  });
  const upper = clean.replace(/[^A-Za-z]/g, '');
  return upper.slice(0, 3).toUpperCase();
}

function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}
