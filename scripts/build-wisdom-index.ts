#!/usr/bin/env tsx
/**
 * Build Wisdom Index
 *
 * Parses curated TEI XML files from SARIT-corpus/, extracts wisdom candidates,
 * scores them, pre-generates IAST + Devanagari versions, and outputs
 * public/wisdom-index.json.
 *
 * Usage: npm run build:wisdom-index
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseTEI } from '../src/lib/tei/teiParser';
import { extractCandidates } from '../src/lib/tei/wisdomCandidateExtractor';
import { scoreCandidate, QUALITY_THRESHOLD } from '../src/lib/tei/qualityScorer';
import type {
  WisdomIndex,
  WisdomTextMeta,
  WisdomCandidate,
  CuratedTextConfig,
  RawCandidate,
} from '../src/lib/tei/teiTypes';

// ─── Limits ──────────────────────────────────────────────────────

/** Maximum candidates to keep per text (take the highest-quality ones) */
const MAX_CANDIDATES_PER_TEXT = 500;

// ─── Curated Text List ───────────────────────────────────────────

const CURATED_TEXTS: CuratedTextConfig[] = [
  // Vedanta
  { fileName: 'astavakragita.xml', category: 'Vedanta', script: 'sa-Latn' },
  { fileName: 'madhusudanasarasvati-atmabodhaprakarana.xml', category: 'Vedanta', script: 'sa-Latn' },
  { fileName: 'jnanadasa-aparoksanubhava-tika.xml', category: 'Vedanta', script: 'sa-Latn' },

  // Darshana
  { fileName: 'sarvadarsanasangraha.xml', category: 'Darshana', script: 'sa-Latn' },
  { fileName: 'bhartrhari-vakyapadiya.xml', category: 'Darshana', script: 'sa-Latn' },
  { fileName: 'kumarila-tantravarttika.xml', category: 'Darshana', script: 'sa-Latn' },
  { fileName: 'vatsyayana-nyayabhasya.xml', category: 'Darshana', script: 'sa-Latn' },
  { fileName: 'prasastapada-padarthadharmasangraha.xml', category: 'Darshana', script: 'sa-Latn' },
  { fileName: 'pujyapada-sarvarthasiddhi.xml', category: 'Darshana', script: 'sa-Latn' },

  // Yoga
  { fileName: 'patanjalayogasastra.xml', category: 'Yoga', script: 'sa-Latn' },
  { fileName: 'bhoja-rajamartanda.xml', category: 'Yoga', script: 'sa-Latn' },
  { fileName: 'yogapradipa.xml', category: 'Yoga', script: 'sa-Latn' },
  { fileName: 'caryamelapakapradipa.xml', category: 'Yoga', script: 'sa-Latn' },

  // Puranas
  { fileName: 'brahmapurana.xml', category: 'Puranas', script: 'sa-Latn' },
  { fileName: 'skandapurana.xml', category: 'Puranas', script: 'sa-Deva' },

  // Epics
  { fileName: 'mahabharata-devanagari.xml', category: 'Epics', script: 'sa-Deva' },

  // Buddhist
  { fileName: 'asvaghosa-buddhacarita.xml', category: 'Buddhist', script: 'sa-Latn' },

  // Dharmashastra
  { fileName: 'manusmrti.xml', category: 'Dharmashastra', script: 'sa-Latn' },
  { fileName: 'naradasmrti.xml', category: 'Dharmashastra', script: 'sa-Latn' },
  { fileName: 'kautalyarthasastra.xml', category: 'Dharmashastra', script: 'sa-Latn' },

  // ─── GRETIL TEI additions ───────────────────────────────────────

  // Epics (GRETIL)
  { fileName: 'sa_bhagavadgita-4comm.xml', category: 'Epics', script: 'sa-Latn',
    displayName: 'Bhagavad Gītā' },
  { fileName: 'sa_ramayana.xml', category: 'Epics', script: 'sa-Latn',
    displayName: 'Vālmīki Rāmāyaṇa' },

  // Upanishads (GRETIL)
  { fileName: 'sa_kathopanisad.xml', category: 'Upanishads', script: 'sa-Latn',
    displayName: 'Kaṭhopaniṣad' },
  { fileName: 'sa_svetasvataropanisad.xml', category: 'Upanishads', script: 'sa-Latn',
    displayName: 'Śvetāśvataropaniṣad' },
  { fileName: 'sa_brhadaranyakopanisad-comm.xml', category: 'Upanishads', script: 'sa-Latn',
    displayName: 'Bṛhadāraṇyakopaniṣad' },
  { fileName: 'sa_chandogyopanisad-comm.xml', category: 'Upanishads', script: 'sa-Latn',
    displayName: 'Chāndogyopaniṣad' },
  { fileName: 'sa_aitareyopanisad-comm.xml', category: 'Upanishads', script: 'sa-Latn',
    displayName: 'Aitareyopaniṣad' },
  { fileName: 'sa_taittiriyopanisad-comm.xml', category: 'Upanishads', script: 'sa-Latn',
    displayName: 'Taittirīyopaniṣad' },
];

// ─── Transliteration ─────────────────────────────────────────────

// We use sanscript directly for build-time transliteration instead of the
// TransliterationService singleton (which has runtime detection we don't need).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sanscriptLib = require('sanscript');

function toDevanagari(iast: string): string {
  try {
    return sanscriptLib.t(iast, 'iast', 'devanagari');
  } catch {
    return iast; // Fallback: return original
  }
}

function toIAST(devanagari: string): string {
  try {
    return sanscriptLib.t(devanagari, 'devanagari', 'iast');
  } catch {
    return devanagari;
  }
}

// ─── Main Build Function ─────────────────────────────────────────

async function buildWisdomIndex(): Promise<void> {
  const corpusDir = path.resolve(__dirname, '../SARIT-corpus');
  const outputPath = path.resolve(__dirname, '../public/wisdom-index.json');

  console.log('=== Building Wisdom Index ===\n');
  console.log(`Corpus directory: ${corpusDir}`);
  console.log(`Output: ${outputPath}\n`);

  const texts: WisdomTextMeta[] = [];
  const allCandidates: WisdomCandidate[] = [];

  let totalRaw = 0;
  let totalPassed = 0;

  for (const config of CURATED_TEXTS) {
    const filePath = path.join(corpusDir, config.fileName);

    if (!fs.existsSync(filePath)) {
      console.warn(`  SKIP: ${config.fileName} not found`);
      continue;
    }

    console.log(`Processing: ${config.fileName} (${config.category})...`);

    try {
      const xmlContent = fs.readFileSync(filePath, 'utf-8');
      const doc = parseTEI(xmlContent);

      // Extract raw candidates
      const rawCandidates = extractCandidates(doc);
      totalRaw += rawCandidates.length;
      console.log(`  Raw candidates: ${rawCandidates.length}`);

      // Score and filter
      let scored = rawCandidates
        .map(rc => ({ raw: rc, score: scoreCandidate(rc) }))
        .filter(({ score }) => score >= QUALITY_THRESHOLD);

      console.log(`  Passed quality threshold (>=${QUALITY_THRESHOLD}): ${scored.length}`);

      // Cap per-text to avoid massive indexes from large texts
      if (scored.length > MAX_CANDIDATES_PER_TEXT) {
        scored.sort((a, b) => b.score - a.score);
        scored = scored.slice(0, MAX_CANDIDATES_PER_TEXT);
        console.log(`  Capped to top ${MAX_CANDIDATES_PER_TEXT} by quality`);
      }

      totalPassed += scored.length;

      // Generate IAST + Devanagari for each candidate
      const textId = config.fileName.replace('.xml', '');
      const displayName = config.displayName || doc.title;

      for (const { raw, score } of scored) {
        const candidate = finishCandidate(raw, score, textId, config.script);
        allCandidates.push(candidate);
      }

      texts.push({
        id: textId,
        displayName,
        category: config.category,
        originalScript: config.script,
        fileName: config.fileName,
        candidateCount: scored.length,
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR processing ${config.fileName}: ${msg}`);
    }
  }

  // Build the index
  const index: WisdomIndex = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    texts,
    candidates: allCandidates,
  };

  // Write output
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2), 'utf-8');

  // Print report
  printReport(index, totalRaw, totalPassed);
}

// ─── Candidate Finalization ──────────────────────────────────────

function finishCandidate(
  raw: RawCandidate,
  score: number,
  textId: string,
  script: 'sa-Latn' | 'sa-Deva'
): WisdomCandidate {
  // Generate both IAST and Devanagari
  let iast: string;
  let devanagari: string;

  if (script === 'sa-Latn') {
    iast = raw.text;
    devanagari = toDevanagari(raw.text);
  } else {
    devanagari = raw.text;
    iast = toIAST(raw.text);
  }

  const ref = raw.reference;
  const id = `${textId}-${ref.chapter}-${ref.verseStart}` +
    (ref.verseEnd !== ref.verseStart ? `-${ref.verseEnd}` : '');

  return {
    id,
    textId,
    iast,
    devanagari,
    reference: ref,
    structureType: raw.structureType,
    qualityScore: Math.round(score * 100) / 100,
    charCount: iast.length,
  };
}

// ─── Report ──────────────────────────────────────────────────────

function printReport(index: WisdomIndex, totalRaw: number, totalPassed: number): void {
  console.log('\n=== Wisdom Index Report ===\n');
  console.log(`Texts processed: ${index.texts.length}`);
  console.log(`Total raw candidates: ${totalRaw}`);
  console.log(`Passed quality filter: ${totalPassed} (${((totalPassed / totalRaw) * 100).toFixed(1)}%)`);
  console.log(`Final candidates: ${index.candidates.length}\n`);

  // Per-text summary
  console.log('Per-text breakdown:');
  console.log('─'.repeat(70));
  console.log(
    'Text'.padEnd(40) +
    'Category'.padEnd(15) +
    'Count'.padEnd(10) +
    'Script'
  );
  console.log('─'.repeat(70));

  for (const text of index.texts) {
    console.log(
      text.displayName.slice(0, 38).padEnd(40) +
      text.category.padEnd(15) +
      String(text.candidateCount).padEnd(10) +
      text.originalScript
    );
  }

  // Quality distribution
  const scores = index.candidates.map(c => c.qualityScore);
  const buckets = [0, 0, 0, 0, 0]; // 0.5-0.6, 0.6-0.7, 0.7-0.8, 0.8-0.9, 0.9-1.0
  for (const s of scores) {
    const idx = Math.min(4, Math.floor((s - 0.5) * 10));
    if (idx >= 0) buckets[idx]++;
  }

  console.log('\nQuality distribution:');
  const labels = ['0.50-0.59', '0.60-0.69', '0.70-0.79', '0.80-0.89', '0.90-1.00'];
  const maxBucket = buckets.reduce((a, b) => Math.max(a, b), 1);
  for (let i = 0; i < 5; i++) {
    const bar = '█'.repeat(Math.ceil(buckets[i] / maxBucket * 30));
    console.log(`  ${labels[i]}: ${bar} ${buckets[i]}`);
  }

  // Length histogram
  const lengths = index.candidates.map(c => c.charCount);
  let minLen = Infinity, maxLen = 0, sumLen = 0;
  for (const l of lengths) {
    if (l < minLen) minLen = l;
    if (l > maxLen) maxLen = l;
    sumLen += l;
  }
  console.log(`\nLength range: ${minLen} - ${maxLen} chars`);
  console.log(`Average length: ${Math.round(sumLen / lengths.length)} chars`);

  // Category distribution
  const catCounts: Record<string, number> = {};
  for (const c of index.candidates) {
    const text = index.texts.find(t => t.id === c.textId);
    if (text) {
      catCounts[text.category] = (catCounts[text.category] || 0) + 1;
    }
  }
  console.log('\nCategory distribution:');
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  console.log(`\nOutput written to public/wisdom-index.json (${(JSON.stringify(index).length / 1024).toFixed(0)} KB)`);
}

// ─── Run ─────────────────────────────────────────────────────────

buildWisdomIndex().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
